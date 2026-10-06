import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const dir = mkdtempSync("/tmp/kline-ecc-entry-ui-");
await build({ entryPoints: ["scripts/fixtures/ecc-form-entry-preview.tsx"], outfile: join(dir, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "preview-link", setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "preview" }));
  builder.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react"; export default function Link({children,...props}) {return <a {...props}>{children}</a>}' }));
} }] });
execFileSync("node", ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(dir, "ui.css")]);
createServer((request, response) => {
  if (request.headers.host !== "127.0.0.1:3325") { response.writeHead(403); return response.end(); }
  const path = new URL(request.url, "http://127.0.0.1:3325").pathname;
  if (["/ui.js", "/ui.css"].includes(path)) {
    response.writeHead(200, { "Content-Type": path.endsWith("css") ? "text/css" : "text/javascript" });
    return response.end(readFileSync(join(dir, path.slice(1))));
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECC 임시 입장 · 모의 화면</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
}).listen(3325, "127.0.0.1", () => console.log("Offline UI only: http://127.0.0.1:3325/"));
