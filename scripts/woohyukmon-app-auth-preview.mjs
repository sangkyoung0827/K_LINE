// Local-only Google OIDC adapter. The deployed routes use K_LINE NextAuth instead.
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile, mkdtemp, stat } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { AsyncLocalStorage } from "node:async_hooks";
import { build } from "esbuild";

const appOrigin = "http://localhost:8097";
const callback = "http://localhost:3300/api/google-forms/oauth/callback";
const { web } = JSON.parse(await readFile(process.argv[2], "utf8"));
if (web.project_id !== "kline-forms-test" || !web.redirect_uris.includes(callback))
  throw new Error("Use only the existing local test OAuth client");
const db = JSON.parse(await readFile("private/supabase-server.local.json", "utf8"));
process.env.SUPABASE_URL = db.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = db.key;
process.env.WOOHYUKMON_APP_WEB_AUTH_ENABLED = "true";
delete process.env.WOOHYUKMON_APP_ENABLED;
const context = new AsyncLocalStorage();
const dir = await mkdtemp(resolve("node_modules", ".woo-auth-preview-"));
const contextKey = Symbol.for("woo-local-auth-preview");
globalThis[contextKey] = context;
await build({
  stdin: { contents: `export {GET as session} from './src/app/api/woohyukmon-app/v1/auth/session/route'; export {memberBy} from './src/lib/woohyukmonApp/server';`, resolveDir: process.cwd(), loader: "ts" },
  outfile: join(dir, "backend.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "verified-test-session", setup(b) {
    b.onResolve({ filter: /^(server-only|@\/auth)$/ }, a => ({ path: a.path, namespace: "local-test" }));
    b.onLoad({ filter: /.*/, namespace: "local-test" }, a => ({ contents: a.path === "server-only" ? "" :
      `export async function auth(){const email=globalThis[Symbol.for('woo-local-auth-preview')].getStore()?.email;return email?{user:{email}}:null;}` }));
  } }],
});
const backend = (await import(pathToFileURL(join(dir, "backend.cjs")).href)).default;
const sessions = new Map(), flows = new Map();
const dist = resolve("mobile/woohyukmon/dist");
const sessionCookie = "woo_preview_session";
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(s => s.trim().split("=")).filter(v => v.length === 2));
const cookie = (key, value, age) => `${key}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}`;
const reply = (res, data, status = 200, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(JSON.stringify(data));
};
const redirect = (res, url, setCookie) => {
  res.writeHead(303, { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...(setCookie ? { "Set-Cookie": setCookie } : {}) }); res.end();
};
const server = createServer(async (req, res) => {
  if (req.headers.host !== "localhost:8097") return reply(res, { error: "INVALID_HOST" }, 403);
  const url = new URL(req.url, appOrigin), jar = cookies(req);
  const stored = sessions.get(jar[sessionCookie]);
  const email = stored?.expires > Date.now() ? stored.email : undefined;
  try {
    if (url.pathname === "/api/woohyukmon-app/v1/auth/web" && req.method === "GET") {
      if (email) return redirect(res, "/Main/My");
      const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
      flows.set(state, { verifier, expires: Date.now() + 600_000 });
      const q = new URLSearchParams({ client_id: web.client_id, redirect_uri: callback, response_type: "code", scope: "openid email profile", prompt: "select_account", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
      return redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${q}`, cookie("woo_preview_state", state, 600));
    }
    if (url.pathname === "/api/google-forms/oauth/callback" && req.method === "GET") {
      const state = url.searchParams.get("state"), flow = flows.get(state); flows.delete(state);
      if (!flow || flow.expires <= Date.now() || jar.woo_preview_state !== state || !url.searchParams.get("code"))
        return reply(res, { error: "INVALID_LOGIN_CALLBACK" }, 400);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20000), body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, redirect_uri: callback, code: url.searchParams.get("code"), code_verifier: flow.verifier, grant_type: "authorization_code" }) });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token) return reply(res, { error: "LOGIN_EXCHANGE_FAILED" }, 400);
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(20000) });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || profile.email_verified !== true || typeof profile.email !== "string")
        return reply(res, { error: "GOOGLE_EMAIL_NOT_VERIFIED" }, 403);
      // Read-only existing identity lookup. No registrations, roles or payment mutations.
      const actor = await backend.memberBy("email", profile.email.trim().toLowerCase());
      const sid = randomBytes(32).toString("base64url");
      sessions.set(sid, { email: actor.email, expires: Date.now() + 3600_000 });
      return redirect(res, `${appOrigin}/Main/My`, [cookie(sessionCookie, sid, 3600), cookie("woo_preview_state", "", 0)]);
    }
    if (url.pathname === "/api/woohyukmon-app/v1/auth/session" && req.method === "GET") {
      const result = await context.run({ email }, () => backend.session(new Request(url, { headers: { cookie: req.headers.cookie || "" } })));
      res.writeHead(result.status, Object.fromEntries(result.headers)); return res.end(await result.text());
    }
    if (url.pathname === "/api/woohyukmon-app/v1/auth/web" && req.method === "POST") {
      if (req.headers.origin !== appOrigin) return reply(res, { error: "INVALID_ORIGIN" }, 403);
      sessions.delete(jar[sessionCookie]);
      return reply(res, { ok: true }, 200, { "Set-Cookie": cookie(sessionCookie, "", 0) });
    }
    if (url.pathname.startsWith("/api/")) return reply(res, { error: "APP_NOT_ENABLED" }, 503);
    if (req.method !== "GET") return reply(res, { error: "METHOD_NOT_ALLOWED" }, 405);
    let file = resolve(dist, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(dist + sep)) file = join(dist, "index.html");
    if (!(await stat(file).catch(() => null))?.isFile()) {
      if (extname(url.pathname)) return reply(res, { error: "NOT_FOUND" }, 404);
      file = join(dist, "index.html");
    }
    const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".css": "text/css" };
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(await readFile(file));
  } catch (e) { reply(res, { error: e?.code || "LOGIN_SERVICE_UNAVAILABLE" }, 503); }
});
// Preserve the already registered Google redirect URI; no Cloud Console change.
const callbackServer = createServer(async (req, res) => {
  if (req.headers.host !== "localhost:3300" || req.method !== "GET" || !req.url.startsWith("/api/google-forms/oauth/callback?"))
    return reply(res, { error: "NOT_FOUND" }, 404);
  try {
    const result = await fetch(appOrigin + req.url, { headers: { cookie: req.headers.cookie || "" }, redirect: "manual", signal: AbortSignal.timeout(45000) });
    const headers = Object.fromEntries(result.headers); delete headers["set-cookie"];
    headers["set-cookie"] = result.headers.getSetCookie();
    res.writeHead(result.status, headers); res.end(await result.text());
  } catch { reply(res, { error: "LOGIN_SERVICE_UNAVAILABLE" }, 503); }
});
server.listen(8097, "127.0.0.1", () => console.log("Local Woohyukmon auth preview: http://localhost:8097/Main/My; existing K_LINE identity reads only"));
callbackServer.listen(3300, "127.0.0.1");
const sweep = setInterval(() => {
  for (const [k, v] of sessions) if (v.expires <= Date.now()) sessions.delete(k);
  for (const [k, v] of flows) if (v.expires <= Date.now()) flows.delete(k);
}, 60000);
process.on("SIGTERM", () => { clearInterval(sweep); server.close(); callbackServer.close(); });
