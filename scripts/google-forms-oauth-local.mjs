// Loopback-only OAuth bootstrap. It does not bypass Next.js authentication.
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const clientPath = process.argv[2];
if (!clientPath) throw new Error("Pass the downloaded OAuth JSON file path.");
const { web } = JSON.parse(readFileSync(clientPath, "utf8"));
const origin = "http://localhost:3300";
const redirectUri = `${origin}/api/google-forms/oauth/callback`;
if (web?.project_id !== "kline-forms-test" || !web.redirect_uris?.includes(redirectUri) || !web.client_secret) throw new Error("Unexpected test OAuth client configuration.");
const keyPath = "private/google-forms-oauth.local.json";
const connectionPath = "private/google-forms-connection.local.json";
const config = existsSync(keyPath) ? JSON.parse(readFileSync(keyPath, "utf8")) : { encryptionKey: randomBytes(48).toString("base64url") };
writeFileSync(keyPath, JSON.stringify(config), { mode: 0o600 });
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = config.encryptionKey;
const temp = mkdtempSync(join(tmpdir(), "kline-oauth-"));
await build({ entryPoints: ["src/lib/googleForms/crypto.ts"], outfile: join(temp, "crypto.mjs"), bundle: true, platform: "node", format: "esm", plugins: [{ name: "server-only", setup(builder) { builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "empty" })); builder.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "", loader: "js" })); } }] });
const { encryptGoogleToken } = await import(pathToFileURL(join(temp, "crypto.mjs")).href);
const scopes = ["openid", "email", "https://www.googleapis.com/auth/forms.body", "https://www.googleapis.com/auth/forms.responses.readonly", "https://www.googleapis.com/auth/drive.file"];
const account = "waterfallingsound0827@gmail.com";
let pending;
let status = "Not connected";
const html = (response, text, code = 200) => { response.writeHead(code, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'", "Referrer-Policy": "no-referrer" }); response.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><title>KLINE Test OAuth</title><main style="max-width:640px;margin:60px auto;padding:24px;font:18px system-ui"><h1>KLINE Test OAuth</h1>${text}</main>`); };
createServer(async (request, response) => {
  if (request.headers.host !== "localhost:3300") return html(response, "Invalid host", 400);
  const url = new URL(request.url, origin);
  try {
    if (url.pathname === "/") {
      const saved = existsSync(connectionPath) ? JSON.parse(readFileSync(connectionPath, "utf8")) : null;
      if (saved?.account_email === account && saved?.verified_at) status = saved.database_verified_at
        ? "Google OAuth connected; offline refresh verified. Encrypted token saved in the private test database."
        : "Google OAuth connected; offline refresh verified. Encrypted token saved locally. Test database installation pending.";
      return html(response, `<p>${status}</p><p>Account: ${account}</p><p>Private test only. No production deployment.</p><a href="/connect">Connect Google Forms</a>`);
    }
    if (url.pathname === "/connect") {
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      pending = { state, verifier, expiresAt: Date.now() + 600_000 };
      const query = new URLSearchParams({ client_id: web.client_id, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: scopes.join(" "), login_hint: account, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
      response.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, "Set-Cookie": `kline_local_oauth=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`, "Cache-Control": "no-store" }); return response.end();
    }
    if (url.pathname === "/api/google-forms/oauth/callback") {
      const cookie = request.headers.cookie?.split("; ").find(x => x.startsWith("kline_local_oauth="))?.slice("kline_local_oauth=".length);
      const flow = pending; pending = undefined;
      response.setHeader("Set-Cookie", "kline_local_oauth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
      if (!flow || flow.expiresAt < Date.now() || cookie !== flow.state || url.searchParams.get("state") !== flow.state || !url.searchParams.get("code")) throw new Error("OAuth state rejected or access not granted.");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, redirect_uri: redirectUri, code: url.searchParams.get("code"), code_verifier: flow.verifier, grant_type: "authorization_code" }) });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) throw new Error("Google did not return an offline connection token.");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || profile.email !== account || profile.email_verified !== true) throw new Error("Wrong Google account or unverified email.");
      const granted = (tokens.scope || "").split(" ");
      if (scopes.filter(x => x.startsWith("https:")).some(x => !granted.includes(x))) throw new Error("Required Forms/Drive scopes were not granted.");
      // Verify that the offline token can actually refresh before saving it.
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, refresh_token: tokens.refresh_token, grant_type: "refresh_token" }) });
      const refreshed = await refreshResponse.json();
      if (!refreshResponse.ok || !refreshed.access_token) throw new Error("Offline token refresh verification failed.");
      writeFileSync(connectionPath, JSON.stringify({ id: "operations", account_email: account, encrypted_refresh_token: encryptGoogleToken(tokens.refresh_token), scopes: granted, connected_by: account, verified_at: new Date().toISOString() }), { mode: 0o600 });
      status = "Google OAuth connected; offline refresh verified. Encrypted token saved locally. Test database installation pending.";
      response.writeHead(303, { Location: "/", "Cache-Control": "no-store" }); return response.end();
    }
    return html(response, "Not found", 404);
  } catch (error) {
    status = "Connection failed; nothing saved.";
    // Never log callback codes, Google responses, credentials or tokens.
    return html(response, `<p>${status}</p><p>${String(error.message).replace(/[<&>]/g, "")}</p><a href="/">Back</a>`, 400);
  }
}).listen(3300, "127.0.0.1", () => console.log("Local OAuth: http://localhost:3300 (test only)"));
