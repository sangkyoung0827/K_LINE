// Isolated UI fixture server. No authentication bypass route is added to Next.js.
import { createServer } from "node:http";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "kline-forms-ui-"));
await build({ entryPoints: ["scripts/fixtures/google-forms-ui.tsx"], outfile: join(temp, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "fixture-link", setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react"; export default function Link({children,...props}) {return <a {...props}>{children}</a>}' }));
} }] });
execFileSync("node", ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(temp, "ui.css")], { stdio: "ignore" });
let workflow;
const form = { id: "fixture-form", club_key: "ecc", title: "ECC Gathering", status: "draft", responder_url: "https://docs.google.com/forms/d/e/test-fixture/viewform", response_count: 1, last_response_sync_at: null };
const mirror = [{ id: "fixture-response", submitted_at: "2026-10-04T09:00:00Z", respondent_email: "person@example.test", answers_json: { Name: ["Test Participant"], Days: ["Friday", "Saturday"] } }];
createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (value, status = 200) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value)); };
  if (url.pathname === "/ui.js" || url.pathname === "/ui.css") { response.writeHead(200, { "Content-Type": url.pathname.endsWith("css") ? "text/css" : "text/javascript" }); response.end(readFileSync(join(temp, url.pathname.slice(1)))); return; }
  if (url.pathname === "/api/google-forms/forms" && request.method === "GET") return send({ access: { manageableClubs: ["ecc"] }, connection: { connected: true, accountEmail: "test@example.test" }, forms: [form] });
  if (url.pathname.endsWith("/responses")) return send({ responses: mirror, count: 1 });
  if (url.pathname.startsWith("/api/")) {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (body.action === "confirm_google_forms") { workflow.workflow_status = "notice_saved"; return send({ workflow, summary: "Private test complete" }); }
    if (body.action?.startsWith("UPDATE_")) { workflow = { ...workflow, draft: body.draft, notice: body.notice, revision: workflow.revision + 1 }; return send({ workflow, token: "fixture-preview" }); }
    if (body.message) return send({ summary: "행사명과 정확한 일시·장소·마감을 입력해주세요.", missing: ["date"] });
    workflow = { id: "fixture-workflow", draft: body, notice: `[${body.title}]\n\n신청 링크 / Application Form URL: {{GOOGLE_FORM_URL}}`, workflow_status: "draft", revision: 1 };
    return send({ workflow, token: "fixture-preview" });
  }
  response.writeHead(200, { "Content-Type": "text/html" });
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Forms UI TEST fixture</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
}).listen(3317, "127.0.0.1", () => console.log("UI fixture: http://127.0.0.1:3317 (mock only; no production access)"));
