// Isolated UI fixture server. No authentication bypass route is added to Next.js.
import { createServer } from "node:http";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fixturePlan } from "./event-studio-harness.mjs";

const temp = mkdtempSync(join(tmpdir(), "kline-forms-ui-"));
const port = Number(process.env.GOOGLE_FORMS_UI_PORT || 3317);
await build({ stdin: { contents: 'export { draftFromTemplate } from "./src/lib/googleForms/templates"; export { generateActivityNotice } from "./src/lib/googleForms/planning";', resolveDir: process.cwd(), loader: "ts" }, outfile: join(temp, "presets.mjs"), bundle: true, platform: "node", format: "esm" });
const { draftFromTemplate, generateActivityNotice } = await import(pathToFileURL(join(temp, "presets.mjs")).href);
await build({ entryPoints: ["scripts/fixtures/google-forms-ui.tsx"], outfile: join(temp, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "fixture-link", setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react"; export default function Link({children,...props}) {return <a {...props}>{children}</a>}' }));
} }] });
execFileSync("node", ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(temp, "ui.css")], { stdio: "ignore" });
let workflow;
let studioJob;
let personalConnected = false, studioCreates = 0;
const form = { id: "fixture-form", google_form_id: "test-fixture", club_key: "ecc", title: "ECC Gathering", status: "draft", responder_url: "https://docs.google.com/forms/d/e/test-fixture/viewform", response_count: 1, last_response_sync_at: null };
const mirror = [{ id: "fixture-response", submitted_at: "2026-10-04T09:00:00Z", respondent_email: "person@example.test", answers_json: { Name: ["Test Participant"], Days: ["Friday", "Saturday"] } }];
createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (value, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value)); };
  if (url.pathname === "/fixture-counts") return send({ studioCreates });
  if (url.pathname === "/api/google-forms/oauth/start") {
    personalConnected = true;
    response.writeHead(302, { Location: `/?personal=1&connected=1&job=${encodeURIComponent(url.searchParams.get("job"))}` }); response.end(); return;
  }
  if (url.pathname === "/ui.js" || url.pathname === "/ui.css") { response.writeHead(200, { "Content-Type": url.pathname.endsWith("css") ? "text/css" : "text/javascript" }); response.end(readFileSync(join(temp, url.pathname.slice(1)))); return; }
  if (url.pathname === "/api/google-forms/forms" && request.method === "GET") return send({ access: { manageableClubs: ["ecc"] }, connection: { connected: true, accountEmail: "test@example.test" }, forms: form.status === "archived" ? [] : [form] });
  if (url.pathname === `/api/google-forms/forms/${form.id}` && request.method === "DELETE") {
    let raw = ""; for await (const chunk of request) raw += chunk;
    if (JSON.parse(raw || "{}").confirmedEnded !== true) return send({ error: "EVENT_END_CONFIRMATION_REQUIRED" }, 400);
    form.status = "archived"; return send({ deleted: true });
  }
  if (url.pathname.endsWith("/responses")) return send({ responses: mirror, count: 1 });
  if (url.pathname === "/api/event-studio") {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (body.action === "list") return send({ jobs: studioJob ? [studioJob] : [], access: { email: "test-admin@example.test", manageableClubs: ["ecc"], readOnly: false, canSetLimits: false }, aiEnabled: true });
    if (body.action === "connection") {
      if (body.clubKey && !["personal", "ecc"].includes(body.clubKey)) return send({ error: "FORBIDDEN" }, 403);
      const connected = body.clubKey === "ecc" || personalConnected;
      return send({ connected, health: connected ? "healthy" : "missing" });
    }
    if (body.action === "plan") {
      const missing = body.message.includes("활동 제목:") ? ["activityDate", "applicationDeadline", "location", "capacity"] : [];
      const plan = fixturePlan(body.clubKey || "personal");
      if (missing.length) Object.assign(plan, { title: "ECC MT UI Test", activityDate: null, applicationDeadline: null, location: null, capacity: null });
      studioJob = { id: "fixture-studio-job", club_key: plan.clubKey, revision: 1, state: "draft", plan, ai_metadata: { model: "gpt-6-luna", requestTurns: [body.message] } };
      return send({ job: studioJob, token: missing.length ? null : "fixture-only-token", creationSupported: true, missing });
    }
    if (body.action === "refine") { studioJob.plan = { ...fixturePlan(studioJob.club_key), title: studioJob.plan.title }; studioJob.revision++; return send({ job: studioJob, token: "fixture-only-token", creationSupported: true, missing: [] }); }
    if (["get", "review"].includes(body.action)) return send({ job: studioJob, token: "fixture-only-token", creationSupported: true, missing: [], ...(studioJob.state === "notice_saved" ? { form: { ...form, edit_url: "https://docs.google.com/forms/d/test-fixture/edit" }, notice: studioJob.plan.noticeKo + "\n\n" + studioJob.plan.noticeEn, applicationUrl: form.responder_url } : {}) });
    if (body.action === "approve") { if (studioJob.state !== "notice_saved") studioCreates++; studioJob.state = "notice_saved"; studioJob.form_registry_id = form.id; form.title = studioJob.plan.title; return send({ job: studioJob, token: null, creationSupported: true, missing: [], form: { ...form, edit_url: "https://docs.google.com/forms/d/test-fixture/edit" }, notice: studioJob.plan.noticeKo + "\n\n" + studioJob.plan.noticeEn, applicationUrl: form.responder_url }); }
    return send({ error: "FIXTURE_OPERATION_NOT_SUPPORTED" }, 400);
  }
  if (url.pathname.startsWith("/api/")) {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (body.action === "confirm_google_forms") { workflow.workflow_status = "notice_saved"; form.title = workflow.draft.title; return send({ workflow, form, notice: workflow.notice.replaceAll("{{GOOGLE_FORM_URL}}", form.responder_url), summary: "Private test complete" }); }
    if (body.action?.startsWith("UPDATE_")) { workflow = { ...workflow, draft: body.draft, notice: body.notice, revision: workflow.revision + 1 }; return send({ workflow, token: "fixture-preview" }); }
    if (body.message) return send({ summary: "행사명과 정확한 일시·장소·마감을 입력해주세요.", missing: ["date"] });
    const draft = body.presetOnly ? draftFromTemplate(body.clubKey, body.templateId, body.title) : body;
    workflow = { id: "fixture-workflow", draft, notice: generateActivityNotice(draft), workflow_status: "draft", revision: 1 };
    return send({ workflow, token: "fixture-preview" });
  }
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Forms UI TEST fixture</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
}).listen(port, "127.0.0.1", () => console.log(`UI fixture: http://127.0.0.1:${port} (mock only; no production access)`));
