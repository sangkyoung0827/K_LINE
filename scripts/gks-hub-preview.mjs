// Local-only UI fixture. Never imported by application routes or production auth.
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import { createGksAccessHarness } from "./lib/gks-hub-harness.mjs";

const root = process.cwd();
const out = await mkdtemp(path.join(tmpdir(), "kline-gks-ui-"));
const actor = role => role === "developer" ? "approved@example.test" : role === "member" ? "member@example.test" : role === "superadmin" ? "superadmin@example.test" : "";
const js = `import React from 'react'; import { createRoot } from 'react-dom/client';
import { GksHub } from './src/components/gks-hub/GksHub';
import { GksHubCard } from './src/components/gks-hub/GksHubCard';
const role = new URLSearchParams(location.search).get('role') || 'developer';
const email = role === 'developer' ? 'approved@example.test' : role === 'member' ? 'member@example.test' : role === 'superadmin' ? 'superadmin@example.test' : '';
const response = await fetch('/api/gks-hub/access'); const access = await response.json();
createRoot(document.getElementById('app')).render(<><div style={{padding:'12px 24px',borderBottom:'1px solid #ccc',fontSize:13}}>Local isolated test · no production data <a style={{marginLeft:20}} href='/?role=developer'>Developer</a> · <a href='/?role=member'>Member</a> · <a href='/?role=superadmin'>Super admin</a> · <a href='/?role=guest'>Guest</a></div>{access.allowed ? <><div style={{maxWidth:380,margin:'24px auto'}}><GksHubCard /></div><GksHub actorEmail={email} draftKey={access.draftKey}/></> : <main style={{padding:40}}><h1>Access denied</h1><p>HTTP {response.status}. Developer test is not available to this account.</p></main>}</>);`;
await build({ stdin: { contents: js, sourcefile: "gks-local-fixture.tsx", resolveDir: root, loader: "tsx" }, outfile: path.join(out, "app.js"), bundle: true, format: "esm", platform: "browser", jsx: "automatic", plugins: [{ name: "isolated-auth", setup(builder) {
  builder.onResolve({ filter: /^(next\/link|next-auth\/react|@\/components\/LanguageProvider)$/ }, args => ({ path: args.path, namespace: "gks-fixture" }));
  builder.onLoad({ filter: /.*/, namespace: "gks-fixture" }, args => ({ resolveDir: root, loader: "jsx", contents: args.path === "next/link" ? "import React from 'react'; export default function Link(props){return <a {...props}/>;}" : args.path === "next-auth/react" ? `export function useSession(){const role=new URLSearchParams(location.search).get('role')||'developer';const email=role==='developer'?'approved@example.test':role==='member'?'member@example.test':role==='superadmin'?'superadmin@example.test':'';return {status:email?'authenticated':'unauthenticated',data:email?{user:{email}}:null};}` : "import React from 'react'; export function useLanguage(){return {language:'ko',pick:value=>value.ko};} export function I18nText({ko}){return <>{ko}</>;}" }));
} }] });
const baseCss = await postcss([tailwind(), autoprefixer()]).process(await readFile("src/app/globals.css", "utf8"), { from: path.join(root, "src/app/globals.css") });
const h = createGksAccessHarness();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role") || req.headers.cookie?.match(/gks-fixture-role=([a-z]+)/)?.[1] || "developer";
    if (url.pathname === "/api/gks-hub/access") {
      h.state.email = actor(role);
      const response = await h.route.GET();
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    if (url.pathname === "/app.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(path.join(out, "app.js"))); return; }
    if (url.pathname === "/app.css") { res.setHeader("Content-Type", "text/css"); res.end(baseCss.css + await readFile(path.join(out, "app.css"), "utf8")); return; }
    if (url.pathname !== "/") { res.writeHead(404); res.end(); return; }
    res.setHeader("Set-Cookie", `gks-fixture-role=${role}; Path=/; HttpOnly; SameSite=Strict`);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
    res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>GKS Hub isolated verification</title><link rel="stylesheet" href="/app.css"></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>');
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
server.listen(Number(process.env.PORT || 3384), "127.0.0.1", () => console.log(`GKS isolated preview: http://127.0.0.1:${server.address().port}/?role=developer`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(async () => { await rm(out, { recursive: true, force: true }); process.exit(0); }));
