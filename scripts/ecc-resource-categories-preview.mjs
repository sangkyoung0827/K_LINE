import { build } from "esbuild";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

const directory = await mkdtemp("/private/tmp/kline-ecc-resource-categories-");
const port = Number(process.env.PORT || 3341);
await build({ entryPoints: ["scripts/fixtures/ecc-resource-categories-preview.tsx"], outfile: join(directory, "ui.js"), bundle: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "local-preview-links", setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, args => ({ path: args.path, namespace: "preview" }));
    builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ loader: "jsx", resolveDir: process.cwd(), contents:
      'import React from "react"; export default function Link({children,href,...props}) {return <a href={href+location.search} {...props}>{children}</a>}' }));
  } }] });
const css = await postcss([tailwind("./tailwind.config.ts"), autoprefixer]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
await writeFile(join(directory, "ui.css"), css.css);
const categories = ["class-research", "notice", "mt", "special-event", "other"];
const resources = [
  ["영어 회화 수업 자료", "class-research", "conversation.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "수업에서 함께 사용하는 발표자료"],
  ["이번 주 활동 공지문", "notice", "notice.pdf", "application/pdf", "신청 기한과 모임 안내"],
  ["MT 준비물 안내", "mt", "mt.pdf", "application/pdf", "MT 일정 및 준비물"],
  ["스페셜 이벤트 운영자료", "special-event", "event.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "행사 진행 자료"],
  ["기존 공유 자료", undefined, "archive.zip", "application/zip", "이전 자료도 그대로 보관됩니다."]
].map(([title, category, fileName, mimeType, description], index) => ({
  id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`, title, category, fileName, mimeType, description,
  sizeBytes: 1024, uploaderName: "ECC 샘플", createdAt: "2026-10-09T00:00:00Z", publishedAt: "2026-10-09T00:00:00Z", status: "published"
}));

createServer(async (request, response) => {
  const json = (status, data) => { response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify(data)); };
  if (request.headers.host !== `127.0.0.1:${port}`) return json(403, { error: "Local preview only." });
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  const role = request.headers["x-preview-role"] || "public";
  try {
    const match = path.match(/^\/api\/ecc\/resources\/([a-f0-9-]+)(\/publish|\/file)?$/);
    const resource = match && resources.find(item => item.id === match[1]);
    if (request.method === "GET" && path === "/api/ecc/resources") return json(200, { resources: resources.filter(item => item.status === "published") });
    if (request.method === "GET" && match) {
      if (!resource || resource.status !== "published") return json(404, { error: "Not found." });
      if (match[2] === "/file") {
        response.writeHead(200, { "Content-Type": "text/plain", "Content-Disposition": 'attachment; filename="preview.txt"' });
        return response.end("Local preview sample. No production file is accessed.");
      }
      return json(200, { resource });
    }
    if (["POST", "PATCH", "PUT"].includes(request.method)) {
      if (request.headers.origin !== `http://127.0.0.1:${port}`) return json(403, { error: "Invalid origin." });
      if (role === "public") return json(403, { error: "Membership required." });
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      if (request.method === "PUT" && path.startsWith("/preview-upload/")) return json(200, {});
      if (request.method === "POST" && match?.[2] === "/publish" && resource) {
        resource.status = "published"; return json(200, { resource });
      }
      const input = JSON.parse(body.toString());
      if (!categories.includes(input.category)) return json(400, { error: "Invalid category." });
      if (request.method === "PATCH" && match && !match[2]) {
        if (role !== "admin") return json(403, { error: "Administrator required." });
        if (!resource) return json(404, { error: "Not found." });
        resource.category = input.category; return json(200, { resource });
      }
      if (request.method === "POST" && path === "/api/ecc/resources") {
        const id = randomUUID();
        resources.unshift({ ...input, id, status: "pending", uploaderName: "로컬 테스트", createdAt: new Date().toISOString(), publishedAt: new Date().toISOString() });
        return json(201, { id, storagePath: `${id}/${input.fileName}`, uploadToken: "local-preview", uploadEndpoint: "/preview-upload/", signedUrl: `/preview-upload/${id}`, mimeType: input.mimeType });
      }
      return json(405, { error: "Unsupported preview action." });
    }
    if (request.method !== "GET") return json(405, { error: "Read only." });
    if (["/ui.js", "/ui.css"].includes(path)) {
      const bytes = await readFile(join(directory, path.slice(1)));
      response.writeHead(200, { "Content-Type": path.endsWith("css") ? "text/css" : "text/javascript", "Cache-Control": "no-store" });
      return response.end(bytes);
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECC 통합자료실 · 분류 미리보기</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
  } catch { json(400, { error: "Invalid preview request." }); }
}).listen(port, "127.0.0.1", () => console.log(`Isolated category preview: http://127.0.0.1:${port}/our-activities/ecc/resources`));
