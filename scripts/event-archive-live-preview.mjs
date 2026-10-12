// Loopback-only operator view over real Supabase. No writes or auth impersonation endpoints.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { build } from "esbuild";
import { liveArchiveRuntime } from "./event-archive-live-runtime.mjs";

const { api, dir, access } = await liveArchiveRuntime(), port = Number(process.env.EVENT_ARCHIVE_LIVE_PORT || 3357);
const view = { ...access, readOnly: true }, token = randomBytes(32).toString("hex"), origin = `http://127.0.0.1:${port}`;
await build({ entryPoints: ["scripts/fixtures/event-archive-live.tsx"], outfile: join(dir, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "local-link", setup(b) { b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local" })); b.onLoad({ filter: /.*/, namespace: "local" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' })); } }] });
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(dir, "ui.css")], { stdio: "ignore" });
const equal = value => typeof value === "string" && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));
const server = createServer(async (req, res) => {
  const send = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) return send({ error: "LOCAL_OPERATOR_ONLY" }, 403);
    const url = new URL(req.url, origin);
    if (url.pathname === "/operator-access" && equal(url.searchParams.get("token"))) {
      const batch = url.searchParams.get("batch"); if (batch) api.uuid(batch);
      res.writeHead(303, { "Set-Cookie": `archive_operator=${token}; HttpOnly; SameSite=Strict; Path=/`, "Location": `/event-studio${batch ? `?batch=${batch}` : ""}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); res.end(); return;
    }
    if (!equal(req.headers.cookie?.match(/(?:^|;\s*)archive_operator=([a-f0-9]+)/)?.[1])) return send({ error: "OPERATOR_ACCESS_REQUIRED" }, 401);
    if (req.method !== "GET") return send({ error: "READ_ONLY_OPERATOR_VIEW" }, 403);
    if (url.pathname === "/ui.js" || url.pathname === "/ui.css") { res.writeHead(200, { "Content-Type": url.pathname.endsWith("css") ? "text/css" : "text/javascript" }); res.end(await readFile(join(dir, url.pathname.slice(1)))); return; }
    if (url.pathname === "/api/event-archive") {
      const q = url.searchParams;
      if (q.get("id") && q.get("asset")) return send(await api.archiveDownload(view, q.get("id"), q.get("asset")));
      if (q.get("id")) return send({ item: await api.loadArchiveItem(view, q.get("id")) });
      return send(await api.listArchive(view, q));
    }
    if (url.pathname.startsWith("/api/")) return send({ error: "READ_ONLY_OPERATOR_VIEW" }, 403);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Studio · 실제 PALBOK 아카이브</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script>window.archiveOperatorView=${JSON.stringify(view).replaceAll("<", "\\u003c")}</script><script src="/ui.js"></script></body></html>`);
  } catch (e) { send({ error: e.code || "ARCHIVE_UNAVAILABLE" }, e.status || 500); }
});
server.listen(port, "127.0.0.1", () => console.log(`Operator view (real Supabase, read-only): ${origin}/operator-access?token=${token}`));
