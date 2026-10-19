import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode, getToken } from "next-auth/jwt";
import { NextRequest } from "next/server.js";

const secret = "co-development-local-test-not-a-production-key";
const dbOrigin = "http://co-dev-db.invalid";
export async function coDevelopmentHarness() {
  const db = new PGlite(); await db.waitReady;
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role; alter default privileges in schema public grant all on tables to anon, authenticated, service_role;");
  const migrations = (await readdir("supabase/migrations")).filter(name => /_co_development_(lab|customization|codex)\.sql$/.test(name)).sort();
  for (const migration of migrations) await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
  const signatures = new Map((await db.query("select proname,proargnames from pg_proc where pronamespace='public'::regnamespace and proname like 'co_dev_%' and proname<>'co_dev_assert'")).rows.map(row => [row.proname, row.proargnames]));
  await db.exec("set role service_role;");
  const originalFetch = globalThis.fetch;
  const identity = new AsyncLocalStorage();
  globalThis.__coDevQA = { identity, secret, getToken };
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.origin !== dbOrigin || !url.pathname.startsWith("/rest/v1/rpc/co_dev_")) throw new Error("UNEXPECTED_EXTERNAL_REQUEST");
    const name = url.pathname.split("/").at(-1);
    const keys = signatures.get(name); if (!keys || init.method !== "POST") throw new Error("UNEXPECTED_RPC");
    const body = JSON.parse(init.body); calls.push({ name, body });
    try {
      const args = keys.map(key => typeof body[key] === "object" && body[key] !== null ? JSON.stringify(body[key]) : body[key]);
      const result = await db.query(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) as result`, args);
      return Response.json(result.rows[0].result);
    } catch (error) { return Response.json({ message: error.message }, { status: 400 }); }
  };
  const directory = await mkdtemp(join(tmpdir(), "co-dev-qa-"));
  await build({
    stdin: { contents: "export * from './src/lib/coDevelopment/model'; export * from './src/lib/coDevelopment/server'; export * from './src/lib/coDevelopment/schema'; export {GET,POST} from './src/app/api/co-development/[[...segments]]/route'; export {middleware} from './src/middleware';", resolveDir: process.cwd(), loader: "ts" },
    outfile: join(directory, "api.cjs"), bundle: true, platform: "node", packages: "external", format: "cjs",
    banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` },
    plugins: [{ name: "isolated-lab", setup(builder) {
      const sources = {
        "server-only": "",
        "@/auth": "export async function auth(){const c=globalThis.__coDevQA;const req=c.identity.getStore();if(!req)return null;const token=await c.getToken({req,secret:c.secret,secureCookie:new URL(req.url).protocol==='https:'});return token?{user:{email:token.email}}:null}",
        "@/lib/supabaseServer": `export function getSupabaseConfig(){return {url:${JSON.stringify(dbOrigin)},serviceRoleKey:'test-only'}};`
      };
      builder.onResolve({ filter: /^(server-only|@\/auth|@\/lib\/supabaseServer)$/ }, args => ({ path: args.path, namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, args => ({ contents: sources[args.path] }));
    } }]
  });
  const api = createRequire(import.meta.url)(join(directory, "api.cjs"));
  const previousSecret = process.env.AUTH_SECRET; process.env.AUTH_SECRET = secret;
  async function cookie(email, https = false) {
    const salt = https ? "__Secure-authjs.session-token" : "authjs.session-token";
    return `${salt}=${await encode({ token: { email }, secret, salt })}`;
  }
  async function handle(request) {
    return identity.run(request, async () => {
      const guard = await api.middleware(request);
      if (guard.status !== 200) return guard;
      const segments = new URL(request.url).pathname.slice("/api/co-development".length).split("/").filter(Boolean);
      return (request.method === "GET" ? api.GET : api.POST)(request, { params: Promise.resolve({ segments }) });
    });
  }
  async function call(body, email = api.labCollaborator, options = {}) {
    const url = options.url || "http://localhost:3365/api/co-development";
    const headers = { "Content-Type": "application/json", origin: new URL(url).origin, ...(email ? { cookie: await cookie(email, url.startsWith("https:")) } : {}), ...options.headers };
    return handle(new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) }));
  }
  return { api, db, calls, handle, cookie, call, async close() {
    globalThis.fetch = originalFetch; delete globalThis.__coDevQA;
    if (previousSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previousSecret;
    await db.close(); await rm(directory, { recursive: true, force: true });
  } };
}
