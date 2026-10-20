// Loopback-only actual service + isolated Postgres, with explicitly mocked AI/Google.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { eventHarness, fixturePlan } from "./event-studio-harness.mjs";

const port = Number(process.env.STUDIO_PERSONAL_PREVIEW_PORT || 3364);
const origin = `http://127.0.0.1:${port}`;
const h = await eventHarness();
h.control.clubs = []; h.control.email = "qa-organizer@example.test";
await h.store.db.query("insert into kline_forms_test_google_oauth_connections(id,account_email,encrypted_refresh_token,scopes,connected_by) values($1,$2,$3,ARRAY['https://www.googleapis.com/auth/forms.body'],$2)", [h.api.personalGoogleConnectionId(h.control.email), h.control.email, h.api.encryptGoogleToken("qa-personal-only")]);
const temp = await mkdtemp(join(tmpdir(), "studio-personal-ui-"));
await build({ entryPoints: ["scripts/fixtures/event-studio-personal-preview.tsx"], outfile: join(temp, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "fixture-link", setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local" }));
  b.onLoad({ filter: /.*/, namespace: "local" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' }));
} }] });
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(temp, "ui.css")], { stdio: "ignore" });
const session = randomBytes(24).toString("hex");
let working = false;
function hanhwalFixture(complete) {
  const plan = fixturePlan("personal");
  Object.assign(plan, {
    title: "[검증용] 한활 한국 국궁 문화 체험",
    descriptionKo: "국궁의 문화와 기본 예절을 알아보고 활쏘기 동작을 함께 살펴보는 프로그램 제안입니다. 실제 사격은 장소·장비·지도 인력이 확인된 경우에만 진행합니다. 실제 모집이 아닌 연동 검증용 행사입니다.",
    descriptionEn: "A proposed introduction to Korean archery culture, etiquette and movement. Actual shooting is conditional on confirmation of a suitable venue, equipment and qualified supervision. This is an integration test, not recruitment.",
    noticeKo: "[검증용] 한활 한국 국궁 문화 체험 안내\n한국의 전통 활 문화에 관심 있는 사람들이 서로의 경험을 나누며 국궁의 예절과 동작을 알아보는 시간을 제안합니다. 실제 모집 공지가 아닙니다.\n\n제안 프로그램\n1. 서로 인사하고 각 나라에서 접한 활 문화와 이미지를 이야기합니다.\n2. 국궁의 기본 예절과 안전수칙을 알아보고, 발사하지 않는 기본 동작을 살펴봅니다.\n3. 실제 사격 체험은 장소·장비·지도 인력이 확인된 경우에만 별도로 확정합니다. 마무리에는 인상 깊었던 문화를 나눕니다.\n\n일정 및 장소\n" + (complete ? "2026년 11월 7일 18:00 한국 시간, QA Library, 30명" : "행사 일시·장소·모집 인원은 미정이며 확인 후 안내합니다.") + "\n\n신청 안내\n" + (complete ? "2026년 11월 6일 18:00 한국 시간까지 신청합니다. " : "신청 마감은 미정입니다. ") + "이름을 작성하고, 희망 프로그램과 경험은 선택적으로 알려주세요. 비용과 준비물은 별도 확인이 필요합니다.",
    noticeEn: "[TEST] Korean archery culture experience\nWe propose a shared introduction to Korean archery culture and etiquette, bringing together different cultural perspectives. This is an integration test, not actual recruitment.\n\nProposed program\n1. Introduce yourselves and exchange stories about archery traditions in different countries.\n2. Explore basic etiquette and safety rules, then review movement without releasing arrows.\n3. Actual shooting remains conditional on confirmation of suitable facilities, equipment and qualified supervision. Finish by sharing a memorable cultural insight.\n\nSchedule and venue\n" + (complete ? "7 November 2026, 18:00 KST, QA Library, 30 people." : "The schedule, venue and capacity are pending confirmation.") + "\n\nApplication\n" + (complete ? "Apply by 6 November 2026, 18:00 KST. " : "The deadline is pending confirmation. ") + "Provide your name; experience and program preferences are optional. Fees and preparation remain unconfirmed.",
  });
  if (!complete) Object.assign(plan, { activityDate: null, applicationDeadline: null, capacity: null, location: null });
  plan.questions.push({ id: "program", title: "희망 프로그램 / Program preference", type: "checkbox", required: false, options: ["국궁 문화 / Archery culture", "기본 동작 / Basic movement", "문화 이야기 / Cultural exchange"] });
  return plan;
}
const server = createServer(async (req, res) => {
  const send = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  if (req.headers.host !== `127.0.0.1:${port}`) return send({ error: "INVALID_HOST" }, 403);
  const url = new URL(req.url, origin);
  try {
    if (url.pathname === "/images/k-line-official-logo.png") { res.writeHead(200, { "Content-Type": "image/png" }); return res.end(await readFile("public/images/k-line-official-logo.png")); }
    if (url.pathname === "/ui.js" || url.pathname === "/ui.css") { res.writeHead(200, { "Content-Type": url.pathname.endsWith("css") ? "text/css" : "text/javascript" }); return res.end(await readFile(join(temp, url.pathname.slice(1)))); }
    if (url.pathname === "/api/event-studio" && req.method === "POST") {
      if (req.headers.origin !== origin || !req.headers.cookie?.split("; ").includes(`studio_preview=${session}`)) return send({ error: "INVALID_ORIGIN" }, 403);
      let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 60000) return send({ error: "REQUEST_TOO_LARGE" }, 413); }
      if (working) return send({ error: "TEST_ACTION_RUNNING" }, 409);
      working = true;
      try {
        const body = JSON.parse(raw);
        if (["plan", "refine"].includes(body.action)) h.control.currentPlan = hanhwalFixture(body.action === "refine");
        const result = await h.api.studioOperation(h.access(), body);
        return send(result);
      } finally { working = false; }
    }
    if (url.pathname !== "/") return send({ error: "NOT_FOUND" }, 404);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": `studio_preview=${session}; HttpOnly; SameSite=Strict; Path=/`, "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" });
    res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Studio · 개인 행사 격리 검증</title><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script></html>');
  } catch (error) { send({ error: error.code || "PREVIEW_FAILED" }, error.status || 500); }
});
server.listen(port, "127.0.0.1", () => console.log(`Personal studio preview: ${origin} (MOCK AI/Google, isolated DB)`));
async function stop() { server.close(); await h.close(); process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
