// Loopback-only operator test: real application services/AI/Google, local Postgres.
// This does not bypass or certify the production Next.js login/session system.
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { eventHarness } from "./event-studio-harness.mjs";

if (!process.argv.includes("--approved-live-services")) throw Error("LIVE_SERVICES_APPROVAL_REQUIRED");
if (!process.env.MT_AUDIT_KEY_FILE || !process.env.MT_GOOGLE_CONFIG_FILE || !process.env.MT_LIVE_REPORT) throw Error("LOCAL_PATHS_REQUIRED");
const ai = parseEnv(await readFile(process.env.MT_AUDIT_KEY_FILE, "utf8"));
const google = parseEnv(await readFile(process.env.MT_GOOGLE_CONFIG_FILE, "utf8"));
if (google.GOOGLE_FORMS_CLIENT_ID !== "777055923708-gu8dg3dlvbrcf81l3fd3lnbmutqsro6t.apps.googleusercontent.com") throw Error("UNEXPECTED_OAUTH_CLIENT");
Object.assign(process.env, { OPENAI_API_KEY: ai.OPENAI_API_KEY, WOOHYUKMON_PREVIEW_OPENAI_ENABLED: "true", WOOHYUKMON_LIVE_GOOGLE_TEST_ENABLED: "true" });
const reportPath = process.env.MT_LIVE_REPORT;
const h = await eventHarness({ liveOpenAI: true, liveGoogle: true, google: { clientId: google.GOOGLE_FORMS_CLIENT_ID, clientSecret: google.GOOGLE_FORMS_CLIENT_SECRET } });
const origin = "http://localhost:3300";
const cookie = randomBytes(32).toString("hex");
let consent = null, working = false;
const temp = await mkdtemp(join(tmpdir(), "ecc-mt-live-ui-"));
await build({ entryPoints: ["scripts/fixtures/event-studio-mt-live.tsx"], outfile: join(temp, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "local-link", setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local" }));
  b.onLoad({ filter: /.*/, namespace: "local" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' }));
} }] });
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(temp, "ui.css")], { stdio: "ignore" });
const equal = (a, b) => { const x = Buffer.from(a || ""), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
// PGlite yields Date objects; application services receive JSON timestamps via PostgREST.
const wireValue = value => JSON.parse(JSON.stringify(value));
async function save() {
  const rows = async table => (await h.store.db.query(`select * from kline_forms_test_${table}`)).rows;
  await writeFile(reportPath, JSON.stringify({ at: new Date().toISOString(), realOpenAI: true, realGoogle: true, productionWrites: 0, normalNextAuthVerified: false,
    aiCalls: h.control.aiCalls, remoteCreates: h.control.externalCreates, jobs: await rows("event_studio_jobs"), forms: await rows("google_forms"), notices: await rows("club_board_posts"), responses: await rows("google_form_responses"), aiOutputs: h.control.liveAIOutputs }, null, 2), { mode: 0o600 });
}
async function form(id) {
  const row = (await h.store.db.query("select * from kline_forms_test_google_forms where id=$1", [id])).rows[0];
  if (!row || !/검증|\btest\b/i.test(row.title)) throw Error("TEST_FORM_REQUIRED");
  return wireValue(row);
}
const server = createServer(async (req, res) => {
  const send = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
  if (req.headers.host !== "localhost:3300") return send({ error: "INVALID_HOST" }, 403);
  const url = new URL(req.url, origin);
  const session = req.headers.cookie?.split("; ").find(value => value.startsWith("mt_operator="))?.slice("mt_operator=".length);
  try {
    if (url.pathname === "/ui.js" || url.pathname === "/ui.css") { res.writeHead(200, { "Content-Type": url.pathname.endsWith("css") ? "text/css" : "text/javascript" }); return res.end(await readFile(join(temp, url.pathname.slice(1)))); }
    if (url.pathname.startsWith("/api/")) {
      if (!equal(session, cookie) || req.method !== "GET" && req.headers.origin !== origin) return send({ error: "SESSION_OR_ORIGIN_REQUIRED" }, 403);
      if (url.pathname === "/api/google-forms/oauth/start") {
        consent = { state: randomBytes(32).toString("hex"), expires: Date.now() + 600000 };
        res.writeHead(302, { Location: h.api.googleAuthorizationUrl(consent.state), "Cache-Control": "no-store" }); return res.end();
      }
      if (url.pathname === "/api/google-forms/oauth/callback") {
        if (!consent || consent.expires < Date.now() || !equal(url.searchParams.get("state"), consent.state)) return send({ error: "OAUTH_STATE_INVALID" }, 403);
        consent = null;
        if (!url.searchParams.get("code")) return send({ error: "OAUTH_NOT_APPROVED" }, 400);
        const account = await h.api.connectGoogleOperationsAccount(url.searchParams.get("code"), h.control.email);
        if (account !== h.control.email) { await h.store.db.query("delete from kline_forms_test_google_oauth_connections"); throw Error("EXPECTED_GOOGLE_ACCOUNT_REQUIRED"); }
        res.writeHead(302, { Location: "/?connected=1", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); return res.end();
      }
      if (url.pathname === "/api/google-forms/forms" && req.method === "GET") {
        const forms = (await h.store.db.query("select * from kline_forms_test_google_forms order by created_at desc")).rows;
        return send({ access: { manageableClubs: ["ecc"] }, connection: await h.api.getGoogleConnectionStatus(), forms,
          internalTests: Object.fromEntries(forms.map(row => [row.id, { canOpen: row.status !== "archived", canClose: row.status === "open" }])) });
      }
      const responsePath = /^\/api\/google-forms\/forms\/([0-9a-f-]{36})\/responses$/.exec(url.pathname);
      if (responsePath && ["GET", "POST"].includes(req.method)) {
        await form(responsePath[1]);
        const result = await (req.method === "GET" ? h.api.getResponses : h.api.syncResponses)(new Request(url, { method: req.method }), { params: Promise.resolve({ id: responsePath[1] }) });
        await save(); return send(await result.json(), result.status);
      }
      let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 60000) return send({ error: "BODY_TOO_LARGE" }, 413); }
      const body = JSON.parse(raw || "{}");
      if (url.pathname === "/api/event-studio" && req.method === "POST") {
        if (!["list", "get", "plan", "refine", "review", "approve"].includes(body.action)) return send({ error: "TEST_ACTION_NOT_ALLOWED" }, 403);
        if (["plan", "refine", "approve"].includes(body.action)) {
          if (working) return send({ error: "TEST_ACTION_RUNNING" }, 409);
          working = true;
          try {
            if (body.action === "approve") {
              if ((await h.api.getGoogleConnectionStatus()).health !== "healthy") throw Error("GOOGLE_RECONNECT_REQUIRED");
              const job = (await h.store.db.query("select plan from kline_forms_test_event_studio_jobs where id=$1", [body.jobId])).rows[0];
              if (!job || job.plan.capacity !== 50 || !/검증|\btest\b/i.test(job.plan.title)) throw Error("FIFTY_PERSON_TEST_EVENT_REQUIRED");
              if (h.control.externalCreates >= 2) throw Error("TWO_TEST_FORMS_ONLY");
            }
            const result = await h.api.studioOperation(h.access(), body); await save(); return send(result);
          } finally { working = false; }
        }
        return send(await h.api.studioOperation(h.access(), body));
      }
      const statusPath = /^\/api\/google-forms\/forms\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (statusPath && req.method === "PATCH" && body.confirmedInternalTest === true && ["open", "closed"].includes(body.status)) {
        const row = await form(statusPath[1]);
        process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED = "true";
        try { await h.api.setGoogleFormStatus(row, body.status); } finally { delete process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED; }
        await save(); return send({ saved: true });
      }
      return send({ error: "NOT_FOUND" }, 404);
    }
    if (url.pathname !== "/") return send({ error: "NOT_FOUND" }, 404);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": `mt_operator=${cookie}; HttpOnly; SameSite=Lax; Path=/`, "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" });
    res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECC MT 실제 연동 검증 · 로컬 전용</title><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script></html>');
  } catch (error) { await save().catch(() => {}); send({ error: error.code || error.message }, error.status || 500); }
});
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  for (const row of wireValue((await h.store.db.query("select * from kline_forms_test_google_forms where status='open'")).rows)) {
    process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED = "true";
    try { await h.api.setGoogleFormStatus(row, "closed"); } catch { console.error("TEST_FORM_CLOSE_REQUIRES_ATTENTION", row.id); }
    finally { delete process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED; }
  }
  await save(); server.close(); await h.close(); process.exit(0);
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
server.listen(3300, "127.0.0.1", () => console.log("Actual AI/Google operator: http://localhost:3300 (isolated DB; NOT production login verification)"));
