// Local fixture only. Production authentication and endpoints are never bypassed.
import { createServer } from "node:http";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { archiveHarness, archiveTestOrigin } from "./event-archive-harness.mjs";
import { fixturePlan } from "./event-studio-harness.mjs";

const h = await archiveHarness(), port = Number(process.env.EVENT_ARCHIVE_UI_PORT || 3354);
await build({ entryPoints: ["scripts/fixtures/event-archive-ui.tsx"], outfile: join(h.dir,"ui.js"),
  bundle: true, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "fixture-link", setup(b) {
    b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:'import React from "react";export default function Link({children,...props}){return <a {...props}>{children}</a>}' }));
  } }] });
execFileSync(process.execPath,["node_modules/tailwindcss/lib/cli.js","-i","src/app/globals.css","-o",join(h.dir,"ui.css")],{stdio:"ignore"});
let queue=Promise.resolve();
const server=createServer((req,res)=>{
  queue=queue.then(async()=>{
    const origin=`http://127.0.0.1:${port}`, url=new URL(req.url,origin);
    const send=(value,status=200)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(value).replaceAll(archiveTestOrigin,origin));};
    if(url.pathname==="/ui.js"||url.pathname==="/ui.css"){res.writeHead(200,{"Content-Type":url.pathname.endsWith("css")?"text/css":"text/javascript"});res.end(await readFile(join(h.dir,url.pathname.slice(1))));return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
    const role=req.headers.cookie?.match(/archive_qa_role=(\w+)/)?.[1] || "admin";
    h.control.email=role==="member"?"member@example.test":"qa-admin@example.test";
    h.control.clubs=role==="member"?[]:["ecc","hanhwal","social_impact_union","unclassified"];
    h.control.readOnly=role==="readonly";
    if(url.pathname.startsWith("/storage/")){
      const r=await h.fetch(archiveTestOrigin+url.pathname+url.search,{method:req.method,headers:req.headers,...(body.length?{body}:{})});
      res.writeHead(r.status,{"Content-Type":url.searchParams.has("download")?"application/octet-stream":"image/png",...(url.searchParams.has("download")?{"Content-Disposition":'attachment; filename="original.bin"'}:{})});res.end(Buffer.from(await r.arrayBuffer()));return;
    }
    if(url.pathname.startsWith("/api/event-archive")){
      const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})});
      let r;
      if(url.pathname.endsWith("/ingest"))r=await h.api.ingestPOST(request);
      else if(url.pathname.endsWith("/connector"))r=await h.api.connectorPOST(request);
      else if(url.pathname.endsWith("/legacy"))return send({sources:[]});
      else r=await h.api[req.method==="GET"?"archiveGET":"archivePOST"](request);
      return send(await r.json(),r.status);
    }
    if(url.pathname==="/api/event-studio"){
      const b=JSON.parse(body.toString()||"{}");
      if(b.action==="list")return send({jobs:[],access:{email:h.control.email,manageableClubs:["ecc"],readOnly:false,canSetLimits:false},aiEnabled:true});
      if(b.action==="plan")return send({job:{id:"fixture-job",club_key:"ecc",revision:1,state:"draft",plan:fixturePlan(),ai_metadata:{model:"mock-only",archiveIds:b.archiveIds}},token:"fixture-only",creationSupported:true,missing:[]});
      return send({error:"GOOGLE_CREATION_NOT_AVAILABLE_IN_LOCAL_QA"},400);
    }
    if(url.pathname.startsWith("/api/"))return send({error:"LOCAL_FIXTURE_ONLY"},404);
    const selected=url.searchParams.get("role")||"admin";
    res.writeHead(200,{"Content-Type":"text/html","Set-Cookie":`archive_qa_role=${["admin","member","readonly"].includes(selected)?selected:"admin"}; Path=/; SameSite=Strict`});
    res.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event Studio LOCAL QA</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
  }).catch(e=>{console.error(e.message);if(!res.headersSent)res.writeHead(500);res.end();});
});
server.listen(port,"127.0.0.1",()=>console.log(`Archive UI fixture: http://127.0.0.1:${port} (LOCAL only; no remote Supabase/AI)`));
async function stop(){server.close();await queue;await h.close();process.exit(0);}
process.on("SIGTERM",stop);process.on("SIGINT",stop);
