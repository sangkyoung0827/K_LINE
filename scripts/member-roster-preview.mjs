import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

const directory = await mkdtemp("/private/tmp/kline-member-roster-ui-");
const port = Number(process.env.PORT || 3356);
await build({ entryPoints: ["scripts/fixtures/member-roster-preview.tsx"], outfile: join(directory, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
await build({ entryPoints: ["src/lib/memberRoster.ts"], outfile: join(directory, "roster.mjs"), bundle: true, platform: "node", format: "esm" });
const { createMemberRosterWorkbook, memberRosterMimeType } = await import(pathToFileURL(join(directory, "roster.mjs")));
const css = await postcss([tailwind("./tailwind.config.ts"), autoprefixer]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
const registrations = [
  { id: "local-1", fullName: "테스트 회원 가", studentId: "202600002", paymentConfirmed: true, officialMember: true, status: "approved" },
  { id: "local-2", fullName: "테스트 회원 나", studentId: "00123456", paymentConfirmed: false, officialMember: false, status: "payment_pending" }
].map((item) => ({ googleEmail: `${item.id}@example.test`, googleName: item.fullName, googleAvatarUrl: "", departmentOrMajor: "Sample", nationality: "Test", gender: "Other", kakaoDisplayName: "", kakaoId: "", paymentConfirmedBy: "", paymentConfirmedAt: "", officialMemberApprovedBy: "", officialMemberApprovedAt: "", adminNote: "", createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z", ...item }));
createServer(async (request, response) => {
  if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403); return response.end(); }
  if (request.method !== "GET") { response.writeHead(405); return response.end(); }
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (path === "/ui.js") { response.setHeader("Content-Type", "text/javascript"); return response.end(await readFile(join(directory, "ui.js"))); }
  if (path === "/ui.css") { response.setHeader("Content-Type", "text/css"); return response.end(css.css); }
  if (/^\/api\/(ecc|hanhwal)\/member-registrations$/.test(path)) {
    response.setHeader("Content-Type", "application/json"); return response.end(JSON.stringify({ registrations }));
  }
  const exportMatch = path.match(/^\/api\/(ecc|hanhwal)\/member-registrations\/export$/);
  if (exportMatch) {
    response.writeHead(200, { "Content-Type": memberRosterMimeType, "Content-Disposition": `attachment; filename="${exportMatch[1]}-members-local-test.xlsx"`, "Cache-Control": "private, no-store" });
    return response.end(await createMemberRosterWorkbook(registrations));
  }
  if (path !== "/") { response.writeHead(404); return response.end(); }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>회원 명부 전산화 · 로컬 검증</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
}).listen(port, "127.0.0.1", () => console.log(`Isolated roster preview: http://127.0.0.1:${port}/`));
