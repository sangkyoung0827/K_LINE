// Loopback-only actual service + isolated Postgres. Live AI requires an explicit flag/key;
// Google creation is always blocked, and no arbitrary prompt receives a fixture answer.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { eventHarness } from "./event-studio-harness.mjs";

const port = Number(process.env.STUDIO_PERSONAL_PREVIEW_PORT || 3364);
const origin = `http://127.0.0.1:${port}`;
const liveAI = process.argv.includes("--live-ai");
const h = await eventHarness({ liveOpenAI: liveAI });
h.control.clubs = []; h.control.email = "qa-organizer@example.test";
const temp = await mkdtemp(join(tmpdir(), "studio-personal-ui-"));
await build({ entryPoints: ["scripts/fixtures/event-studio-personal-preview.tsx"], outfile: join(temp, "ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"', "process.env.STUDIO_PREVIEW_LIVE_AI": JSON.stringify(String(liveAI)) }, plugins: [{ name: "fixture-link", setup(b) {
  b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "local" }));
  b.onLoad({ filter: /.*/, namespace: "local" }, () => ({ loader: "tsx", resolveDir: process.cwd(), contents: 'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' }));
} }] });
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-i", "src/app/globals.css", "-o", join(temp, "ui.css")], { stdio: "ignore" });
const session = randomBytes(24).toString("hex");
let working = false;
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
        // Never offer a fixed test fixture as a response to an arbitrary user request.
        if (["approve", "recover", "responses", "limits"].includes(body.action)) return send({ error: "LOCAL_PREVIEW_GOOGLE_DISABLED" }, 403);
        if (!["list", "get", "connection"].includes(body.action) && !liveAI) return send({ error: "LOCAL_PREVIEW_AI_UNAVAILABLE" }, 503);
        if (body.action === "connection") return send({ connected: false });
        const result = await h.api.studioOperation(h.access(), body);
        if (body.action === "list") { result.aiEnabled = liveAI; result.googleConnectAvailable = false; }
        return send(result);
      } finally { working = false; }
    }
    if (url.pathname !== "/") return send({ error: "NOT_FOUND" }, 404);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": `studio_preview=${session}; HttpOnly; SameSite=Strict; Path=/`, "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" });
    res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Studio · 개인 행사 격리 검증</title><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script></html>');
  } catch (error) { send({ error: error.code || "PREVIEW_FAILED" }, error.status || 500); }
});
server.listen(port, "127.0.0.1", () => console.log(`Personal studio preview: ${origin} (${liveAI ? "LIVE OpenAI" : "AI disabled"}, isolated DB, Google creation blocked)`));
async function stop() { server.close(); await h.close(); process.exit(0); }
process.on("SIGINT", stop); process.on("SIGTERM", stop);
