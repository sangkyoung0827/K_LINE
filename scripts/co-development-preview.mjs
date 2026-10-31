import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server.js";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import { coDevelopmentHarness } from "./co-development-harness.mjs";

const harness = await coDevelopmentHarness();
const directory = await mkdtemp(join(tmpdir(), "co-development-ui-"));
await build({ entryPoints: ["scripts/fixtures/co-development-preview.tsx"], outfile: join(directory,"ui.js"), bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name:"local-shell", setup(builder) {
  const sources = {
    "next/link": "export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}",
    "@/components/WoohyukmonLauncher": "export function WoohyukmonLauncher({children,...props}){return <button {...props}>{children}</button>}"
  };
  builder.onResolve({ filter:/^(next\/link|@\/components\/WoohyukmonLauncher)$/ },args=>({path:args.path,namespace:"fixture"}));
  builder.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:sources[args.path],loader:"jsx",resolveDir:process.cwd()}));
} }] });
const css = await postcss([tailwind("./tailwind.config.ts"),autoprefixer]).process(await readFile("src/app/globals.css","utf8"),{from:"src/app/globals.css"});
const allowed = [harness.api.labOwner,harness.api.labCollaborator,"member@example.test","developer@example.test"];
const identities = new Map();
for (const email of allowed) identities.set(await harness.cookie(email),email);
const fixtureCookie = "kline_lab_preview_identity";
const server = createServer(async (request,response)=>{
  const host = request.headers.host;
  if (!/^localhost:\d+$/.test(host || "")) {response.writeHead(403);response.end();return;}
  const origin = `http://${host}`,url = new URL(request.url,origin);
  const chosenIdentity = (request.headers.cookie || "").split(";").map(item=>item.trim()).find(item=>item.startsWith(`${fixtureCookie}=`))?.slice(fixtureCookie.length+1);
  const email = allowed.includes(chosenIdentity) ? chosenIdentity : harness.api.labCollaborator;
  const cookie = [...identities].find(([,value])=>value===email)[0];
  if(url.pathname==="/__fixture/account"){
    const chosen = url.searchParams.get("email");
    if(!allowed.includes(chosen)){response.writeHead(400);response.end();return;}
    response.writeHead(302,{Location:"/","Set-Cookie":`${fixtureCookie}=${chosen}; Path=/; HttpOnly; SameSite=Strict`});response.end();return;
  }
  if(url.pathname==="/__fixture/session"){response.setHeader("Content-Type","application/json");response.end(JSON.stringify({email}));return;}
  if(url.pathname.startsWith("/api/co-development") || url.pathname.startsWith("/.well-known/")){
    const chunks=[];let length=0;
    for await(const chunk of request){length+=chunk.length;if(length>2097152){response.writeHead(413);response.end();return;}chunks.push(chunk);}
    const next = new NextRequest(url,{method:request.method,headers:{...request.headers,cookie:`${cookie}; ${request.headers.cookie || ""}`},...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    const result = await harness.handle(next);response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));return;
  }
  if(url.pathname==="/ui.js"){response.setHeader("Content-Type","text/javascript");response.end(await readFile(join(directory,"ui.js")));return;}
  if(url.pathname==="/ui.css"){response.setHeader("Content-Type","text/css");response.end(css.css);return;}
  if(url.pathname.startsWith("/images/")){
    if(!/^\/images\/[a-zA-Z0-9_./-]+$/.test(url.pathname)||url.pathname.includes("..")){response.writeHead(404);response.end();return;}
    try{response.setHeader("Content-Type",url.pathname.endsWith(".svg")?"image/svg+xml":"image/png");response.end(await readFile("public"+url.pathname));}catch{response.writeHead(404);response.end();}return;
  }
  if(url.pathname!=="/"&&url.pathname!=="/co-development"&&url.pathname!=="/co-development/connect"&&!/^\/services\/[0-9a-f-]{36}$/.test(url.pathname)){response.writeHead(404);response.end();return;}
  if(url.pathname==="/co-development"&&!harness.api.canUseCoDevelopment(email)){response.writeHead(404);response.end("Not found");return;}
  response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>K_LINE 공동개발실 · 로컬 검증</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
});
server.listen(Number(process.env.PORT || 0),"127.0.0.1",()=>{process.env.CO_DEVELOPMENT_OAUTH_ORIGIN=`http://localhost:${server.address().port}`;console.log(`Co-development isolated preview: http://localhost:${server.address().port}/`);});
for(const signal of ["SIGINT","SIGTERM"])process.once(signal,()=>{server.close(async()=>{await harness.close();await rm(directory,{recursive:true,force:true});process.exit(0);});});
