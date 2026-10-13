import { build } from "esbuild";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { clubHarness, decision } from "./woohyukmon-club-harness.mjs";

const h = await clubHarness();
const dir = await mkdtemp(join(tmpdir(), "club-ui-qa-"));
const css = join(dir, "style.css");
const compile = spawnSync("./node_modules/.bin/tailwindcss", ["-i", "src/app/globals.css", "-o", css, "--minify"], { encoding: "utf8" });
if (compile.status) throw Error(compile.stderr);
await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {GlobalWoohyukmon} from './src/components/GlobalWoohyukmon';const q=new URLSearchParams(location.search);const role=q.get('role')||'ecc';const scope=role==='member'||role==='anonymous'||role==='readonly'?'':role;createRoot(document.getElementById('app')).render(role==='anonymous'||role==='readonly'?<p>조회 전용 화면 / View only</p>:<GlobalWoohyukmon actorEmail="qa-manager@example.test" actorRole={role} readOnly={role==='member'} activityGuide={role==='member'} scopes={scope?[scope]:[]}/>);`, resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, jsx: "automatic", format: "iife", platform: "browser", outfile: join(dir, "app.js"),
  plugins: [{ name: "preview-only-hooks", setup(b) {
    const mocks = {
      "next/navigation": "export const usePathname=()=>'/our-activities/'+(new URLSearchParams(location.search).get('role')||'ecc')+'/members';",
      "next/image": "import React from 'react';export default function Image({src,alt,...p}){return <img src={src} alt={alt} style={{maxWidth:'100%',maxHeight:'100%'}}/>}",
      "@/components/LanguageProvider": "export const useLanguage=()=>({pick:x=>x[new URLSearchParams(location.search).get('language')||'ko']});",
      "@/hooks/useConversationMemory": "export const useConversationMemory=()=>({enabled:false,setEnabled:()=>{}});",
      "@/hooks/useSavedConversation": "export const useSavedConversation=()=>({save:async()=>{},clearWarning:()=>{}});"
    };
    b.onResolve({ filter: /^next\/|^@\// }, a => Object.hasOwn(mocks,a.path) ? {path:a.path,namespace:'qa'} : undefined);
    b.onLoad({filter:/.*/,namespace:'qa'},a=>({contents:mocks[a.path],loader:'tsx'}));
  }}] });
const scopes = ["ecc","hanhwal","social_impact_union","jeju","research","event_archive"];
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,"http://127.0.0.1:3358");
    if (url.pathname === "/") {
      const role = url.searchParams.get("role") || "ecc";
      res.setHeader("Set-Cookie",`qa-role=${role}; Path=/; SameSite=Strict`);
      res.setHeader("Content-Type","text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-paper p-5 text-ink"><p>격리 UI 검증 · 모의 데이터/응답 · 운영 DB 연결 없음</p><h1 class="mt-5 font-serif text-2xl">K_LINE · ${scopes.includes(role)?role:'회원 화면'}</h1><div id="app"></div><script src="/app.js"></script></body></html>`); return;
    }
    if (["/style.css","/app.js"].includes(url.pathname)) { res.setHeader("Content-Type",url.pathname.endsWith("css")?"text/css":"text/javascript");res.end(await readFile(join(dir,url.pathname.slice(1))));return; }
    if (url.pathname.startsWith("/images/")) { const path=url.pathname.replaceAll("..","");res.setHeader("Content-Type","image/png");res.end(await readFile(join("public",path)));return; }
    const role = /qa-role=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "anonymous";
    h.state.email = role === "anonymous" ? "" : "qa-manager@example.test";
    h.state.scopes = scopes.includes(role) ? [role] : [];
    h.state.developer = role === "event_archive"; h.state.readOnly = role === "readonly";
    const chunks=[];for await (const chunk of req) chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString();
    const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'?{body:raw}:{})});
    let response;
    if (url.pathname.endsWith("/export")) response = await h.api.exportDocument(request);
    else if (url.pathname === "/api/gemini") response = new Response(JSON.stringify({type:'text',text:'격리 검증: 활동 신청 안내입니다.'})+'\n'+JSON.stringify({type:'done'})+'\n');
    else if(req.method === "GET") response = await h.api.GET();
    else {
      const body=JSON.parse(raw);
      if(body.action !== 'confirm') {
        const cap=role==='hanhwal'?'hanhwal_members':role==='social_impact_union'?'siu_activities':role==='jeju'?'jeju_overview':role==='research'?'research_items':role==='event_archive'?'event_archive':'ecc_members';
        if(/엑셀|xlsx/i.test(body.message))h.state.decisions.push(decision('export',cap,'GET',{}, {},'xlsx'));
        else if(/워드|docx/i.test(body.message))h.state.decisions.push(decision('export',cap,'GET',{}, {},'docx'));
        else if(/미납.*처리/.test(body.message))h.state.decisions.push(decision('write',cap,'PATCH',{registrations:[{id:'qa-member',paymentConfirmed:false}]}));
        else h.state.decisions.push(decision('read',cap));
      }
      response=await h.api.POST(request);
    }
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
server.listen(3358,"127.0.0.1",()=>console.log("Isolated preview http://127.0.0.1:3358/?role=hanhwal"));
process.on("SIGINT",async()=>{server.close();await h.close();process.exit(0)});
