import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

const directory = await mkdtemp("/private/tmp/kline-ecc-registration-ui-");
const port = Number(process.env.PORT || 3340);
await build({ entryPoints: ["scripts/fixtures/ecc-registration-summary-preview.tsx"], outfile: join(directory, "ui.js"), bundle: true, platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "local-preview-navigation", setup(builder) {
    builder.onResolve({ filter: /^(next\/link|next\/navigation|@\/components\/ReadOnlyDeveloperNotice)$/ }, args => ({ path: args.path, namespace: "preview" }));
    builder.onLoad({ filter: /.*/, namespace: "preview" }, args => ({ loader: "jsx", resolveDir: process.cwd(), contents: args.path === "next/link"
      ? 'import React from "react"; export default function Link({children,...props}) {return <a {...props}>{children}</a>}'
      : args.path === "next/navigation" ? 'export const usePathname=()=>"/ecc-official";'
      : 'export const useReadOnlyDeveloper=()=>false;' }));
  } }] });
const css = await postcss([tailwind("./tailwind.config.ts"), autoprefixer]).process(await readFile("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
await writeFile(join(directory, "ui.css"), css.css);
createServer(async (request, response) => {
  if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403); return response.end(); }
  if (request.method !== "GET") { response.writeHead(405); return response.end(); }
  const path = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (["/ui.js", "/ui.css"].includes(path)) {
    const bytes = await readFile(join(directory, path.slice(1)));
    response.writeHead(200, { "Content-Type": path.endsWith("css") ? "text/css" : "text/javascript", "Cache-Control": "no-store" });
    return response.end(bytes);
  }
  if (path !== "/") { response.writeHead(404); return response.end(); }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECC 등록 상태 · 모바일 미리보기</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
}).listen(port, "127.0.0.1", () => console.log(`Isolated UI preview: http://127.0.0.1:${port}/`));
