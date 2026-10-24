import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { eventHarness, fixturePlan, fixtureMessage } from "./event-studio-harness.mjs";

test("personal OAuth routes bind nonce, identity and mode; callbacks cannot replace operations or replay", async () => {
  const h = await eventHarness();
  try {
    const jar = new Map();
    const cookieWrites = [];
    globalThis.__studioOAuthQA = { api: h.api, jar, cookieWrites };
    const dir = await mkdtemp(join(tmpdir(), "studio-oauth-test-"));
    await build({ stdin: { contents: "export {GET as start} from './src/app/api/google-forms/oauth/start/route';export {GET as callback} from './src/app/api/google-forms/oauth/callback/route';", resolveDir: process.cwd(), loader: "ts" }, outfile: join(dir, "routes.cjs"), bundle: true, packages: "external", platform: "node", format: "cjs", banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` }, plugins: [{ name: "test-session", setup(b) {
      const sources = {
        "server-only": "",
        "next/headers": "export async function cookies(){const {jar,cookieWrites}=globalThis.__studioOAuthQA;return {get:key=>jar.get(key),set:(key,value,options)=>{cookieWrites.push({key,value,options});if(options?.maxAge===0){if(jar.get(key)?.options?.path===options.path)jar.delete(key)}else jar.set(key,{value,options})},delete:key=>jar.delete(key)}}",
        "@/lib/eventStudio/access": "export const getStudioAccess=(...args)=>globalThis.__studioOAuthQA.api.getStudioAccess(...args)",
        "@/lib/eventStudio/model": "export const StudioError=globalThis.__studioOAuthQA.api.StudioError",
        "@/lib/eventStudio/service": "export const studioOperation=(...args)=>globalThis.__studioOAuthQA.api.studioOperation(...args)",
        "@/lib/googleForms/access": "export const getGoogleFormsAccess=(...args)=>globalThis.__studioOAuthQA.api.getGoogleFormsAccess(...args)",
        "@/lib/googleForms/googleApi": "export const googleAuthorizationUrl=(...args)=>globalThis.__studioOAuthQA.api.googleAuthorizationUrl(...args);export const connectGoogleOperationsAccount=(...args)=>globalThis.__studioOAuthQA.api.connectGoogleOperationsAccount(...args);export const withPersonalGoogleConnection=(...args)=>globalThis.__studioOAuthQA.api.withPersonalGoogleConnection(...args)",
      };
      b.onResolve({ filter: /^(server-only|next\/headers|@\/lib\/(eventStudio\/(access|model|service)|googleForms\/(access|googleApi)))$/ }, args => ({ path: args.path, namespace: "test" }));
      b.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: sources[args.path] }));
    } }] });
    const routes = createRequire(import.meta.url)(join(dir, "routes.cjs"));
    h.control.clubs = [];
    const start = () => routes.start(new Request("https://kline.test/api/google-forms/oauth/start?mode=personal"));
    const callback = state => routes.callback(new Request(`https://kline.test/api/google-forms/oauth/callback?state=${encodeURIComponent(state)}&code=qa-consent-code`));
    const operationsBefore = (await h.store.db.query("select * from kline_forms_test_google_oauth_connections where id='operations'")).rows;
    assert.equal((await routes.start(new Request("https://kline.test/api/google-forms/oauth/start"))).status, 403);
    const response = await start(); assert.equal(response.status, 307);
    const state = new URL(response.headers.get("location")).searchParams.get("state");
    assert.equal(jar.get("kline_google_oauth_state").value, state);
    assert.equal(jar.get("kline_google_oauth_state").options.httpOnly, true);
    assert.equal(jar.get("kline_google_oauth_state").options.path, "/api/google-forms/oauth");
    const done = await callback(state);
    assert.equal(done.headers.get("location"), "https://kline.test/event-studio?connected=1");
    assert.equal(jar.size, 0);
    assert.equal(cookieWrites.at(-1).options.maxAge, 0);
    assert.equal(cookieWrites.at(-1).options.path, "/api/google-forms/oauth");
    assert.match((await callback(state)).headers.get("location"), /error=oauth_failed/);
    await start(); const otherState = jar.get("kline_google_oauth_state").value;
    h.control.email = "peer@example.test";
    assert.match((await callback(otherState)).headers.get("location"), /error=oauth_failed/);
    assert.equal((await h.store.db.query("select count(*)::int as n from kline_forms_test_google_oauth_connections where id <> 'operations'")).rows[0].n, 1);
    h.control.readOnly = true; assert.equal((await start()).status, 403);
    h.control.readOnly = false; h.control.email = "";
    assert.equal((await start()).headers.get("location"), "https://kline.test/login?callbackUrl=%2Fevent-studio");
    assert.deepEqual((await h.store.db.query("select * from kline_forms_test_google_oauth_connections where id='operations'")).rows, operationsBefore);
    h.control.email = "test-admin@example.test";
    h.control.oauthEmail = "wrong-owner@example.test";
    await start();
    assert.match((await callback(jar.get("kline_google_oauth_state").value)).headers.get("location"), /error=oauth_account_mismatch/);
    delete h.control.oauthEmail;
    h.control.oauthScopes = "openid email";
    await start();
    assert.match((await callback(jar.get("kline_google_oauth_state").value)).headers.get("location"), /error=oauth_scopes_required/);
    delete h.control.oauthScopes;
    h.control.currentPlan = fixturePlan("personal");
    const access = await h.api.getStudioAccess();
    const draft = await h.api.studioOperation(access, { action: "plan", message: fixtureMessage, clubKey: "personal" });
    const resume = await routes.start(new Request(`https://kline.test/api/google-forms/oauth/start?mode=personal&job=${draft.job.id}`));
    assert.equal(resume.status, 307);
    const resumeState = new URL(resume.headers.get("location")).searchParams.get("state");
    assert.equal((await callback(resumeState)).headers.get("location"), `https://kline.test/event-studio?connected=1&job=${draft.job.id}`);
    const cancel = await routes.start(new Request(`https://kline.test/api/google-forms/oauth/start?mode=personal&job=${draft.job.id}`));
    const cancelState = new URL(cancel.headers.get("location")).searchParams.get("state");
    const cancelled = await routes.callback(new Request(`https://kline.test/api/google-forms/oauth/callback?state=${encodeURIComponent(cancelState)}&error=access_denied`));
    assert.equal(cancelled.headers.get("location"), `https://kline.test/event-studio?error=oauth_failed&job=${draft.job.id}`);
    assert.equal(h.control.externalCreates, 0);
    h.control.email = "peer@example.test";
    const rejected = await routes.start(new Request(`https://kline.test/api/google-forms/oauth/start?mode=personal&job=${draft.job.id}`));
    assert.equal(rejected.status, 503);
  } finally { delete globalThis.__studioOAuthQA; await h.close(); }
});
