import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

test("web login reuses only the authenticated K_LINE identity and never changes club data", async () => {
  const dir = await mkdtemp(resolve("node_modules", ".woo-auth-test-"));
  const oldFetch = globalThis.fetch;
  const keys = ["WOOHYUKMON_APP_ENABLED", "WOOHYUKMON_APP_WEB_AUTH_ENABLED", "WOOHYUKMON_APP_WEB_RETURN_PATH"];
  const oldEnv = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const ctx = { email: null, signedOut: false };
  globalThis[Symbol.for("woo-auth-test")] = ctx;
  try {
    await build({ stdin: { contents: `export {GET as session} from './src/app/api/woohyukmon-app/v1/auth/session/route';export {GET as login,POST as logout} from './src/app/api/woohyukmon-app/v1/auth/web/route';export {webReturnPath} from './src/lib/woohyukmonApp/webAuth';`, loader: "ts", resolveDir: process.cwd() }, outfile: join(dir, "routes.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "auth-test", setup(b) {
      b.onResolve({ filter: /^(server-only|@\/auth|@\/lib\/supabaseServer)$/ }, a => ({ path: a.path, namespace: "test" }));
      b.onLoad({ filter: /.*/, namespace: "test" }, a => ({ contents: a.path === "server-only" ? "" : a.path === "@/auth" ? `const ctx=globalThis[Symbol.for('woo-auth-test')];export async function auth(){return ctx.email?{user:{email:ctx.email}}:null;}export async function signIn(provider,options){throw new Error('GOOGLE_REDIRECT:'+provider+':'+options.redirectTo);}export async function signOut(){ctx.signedOut=true;}` : `export function getSupabaseConfig(){return {url:'https://db.invalid',serviceRoleKey:'test'};}export class SupabaseRequestError extends Error{constructor(m,s){super(m);this.status=s;}}` }));
    } }] });
    const api = (await import(pathToFileURL(join(dir, "routes.cjs")).href)).default;
    const req = new Request("https://kline.invalid/api/woohyukmon-app/v1/auth/session");
    let queries = 0;
    globalThis.fetch = async (url, init) => {
      queries++;
      assert.equal(init.method || "GET", "GET");
      assert.equal(new URL(url).pathname, "/rest/v1/site_members");
      assert.equal(new URL(url).searchParams.get("email"), "eq.test@example.com");
      return new Response(JSON.stringify([{ id: "10000000-0000-4000-8000-000000000001", name: "Existing member", email: "test@example.com", status: "active" }]));
    };
    delete process.env.WOOHYUKMON_APP_ENABLED; delete process.env.WOOHYUKMON_APP_WEB_AUTH_ENABLED;
    assert.equal((await api.session(req)).status, 503); assert.equal(queries, 0);
    process.env.WOOHYUKMON_APP_WEB_AUTH_ENABLED = "true";
    assert.deepEqual(await (await api.session(req)).json(), { user: null }); assert.equal(queries, 0);
    await assert.rejects(api.login(req), /GOOGLE_REDIRECT:google:\/api\/woohyukmon-app\/v1\/auth\/web/);
    ctx.email = " TEST@EXAMPLE.COM ";
    const response = await api.session(req), user = (await response.json()).user;
    assert.equal(user.id, "10000000-0000-4000-8000-000000000001"); assert.equal(user.email, "test@example.com");
    assert.match(response.headers.get("cache-control"), /no-store/); assert.equal(queries, 1);
    const returned = await api.login(new Request("https://kline.invalid/api/woohyukmon-app/v1/auth/web?redirectUri=https://attacker.invalid"));
    assert.equal(returned.headers.get("location"), "https://kline.invalid/woohyukmon/Main/My");
    for (const path of ["//attacker.invalid", "https://attacker.invalid", "/\\attacker", "/../api/auth", "/app?token=secret"]) {
      process.env.WOOHYUKMON_APP_WEB_RETURN_PATH = path;
      assert.throws(api.webReturnPath, /INVALID_LOGIN_CALLBACK/);
    }
    delete process.env.WOOHYUKMON_APP_WEB_RETURN_PATH;
    assert.equal((await api.logout(new Request(req.url, { method: "POST", headers: { origin: "https://attacker.invalid" } }))).status, 403);
    assert.equal(ctx.signedOut, false);
    assert.equal((await api.logout(new Request(req.url, { method: "POST", headers: { origin: "https://kline.invalid" } }))).status, 200);
    assert.equal(ctx.signedOut, true);
    globalThis.fetch = async () => new Response(JSON.stringify([]));
    assert.equal((await api.session(req)).status, 401);
    globalThis.fetch = async () => new Response(JSON.stringify([{ email: "test@example.com", status: "deleted" }]));
    assert.equal((await api.session(req)).status, 401);
  } finally {
    globalThis.fetch = oldFetch; delete globalThis[Symbol.for("woo-auth-test")];
    for (const key of keys) if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
    await rm(dir, { recursive: true, force: true });
  }
});
