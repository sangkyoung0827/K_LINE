import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resourceHarness } from "./lib/hanhwal-resource-harness.mjs";
const {state,service} = resourceHarness(), files = new Map();
const port=Number(process.env.PORT||3363),origin=`http://127.0.0.1:${port}`, dir=await mkdtemp("/private/tmp/hanhwal-resource-ui-");
await build({entryPoints:["scripts/fixtures/hanhwal-resource-preview.tsx"],outfile:join(dir,"ui.js"),bundle:true,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"fixture-link",setup(b){
  b.onResolve({filter:/^next\/link$/},a=>({path:a.path,namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},()=>({loader:"jsx",resolveDir:process.cwd(),contents:'import React from "react"; export default function Link({children,href,...props}) { return <a href={href+location.search} {...props}>{children}</a> }'}));
}}]});
const css=(await postcss([tailwind("./tailwind.config.ts"),autoprefixer]).process(await readFile("src/app/globals.css","utf8")+await readFile("src/app/our-activities/hanhwal/resources/resources.css","utf8"),{from:"src/app/globals.css"})).css;
service.hanhwalStorage.createResourceUploadUrl=async path=>({signedUrl:origin+"/upload/"+path,token:"local-only",endpoint:origin+"/upload/"});
service.hanhwalStorage.inspectResourceFile=async path=>({sizeBytes:files.get(path)?.bytes.length,mimeType:files.get(path)?.type});
service.hanhwalStorage.createResourceReadUrl=async path=>origin+"/file/"+path;
service.hanhwalStorage.deleteResourceFile=async path=>files.delete(path);
createServer(async(req,res)=>{
  const url=new URL(req.url,origin);
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end();}
  try{
    if(url.pathname==="/ui.js"||url.pathname==="/ui.css"){res.writeHead(200,{"Content-Type":url.pathname.endsWith("css")?"text/css":"text/javascript"});return res.end(url.pathname.endsWith("css")?css:await readFile(join(dir,"ui.js")));}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const bytes=Buffer.concat(chunks);
    const request=new Request(url,{method:req.method,headers:req.headers,body:bytes.length?bytes:undefined});
    if(url.pathname.startsWith("/upload/")){
      const form=await request.formData(),file=form.get("");assertFile(file);files.set(url.pathname.slice(8),{bytes:Buffer.from(await file.arrayBuffer()),type:file.type});
      res.writeHead(200,{"Content-Type":"application/json"});return res.end("{}");
    }
    if(url.pathname.startsWith("/file/")){const file=files.get(url.pathname.slice(6));res.writeHead(file?200:404,{"Content-Type":file?.type||"text/plain"});return res.end(file?.bytes||"Not found");}
    if(url.pathname.startsWith("/api/hanhwal/resources")){
      const role=req.headers["x-preview-role"]||"public";
      state.access={email:role==="public"?"":"member@test.invalid",isOfficialMember:role!=="public",isAdmin:role==="admin"};
      const segments=url.pathname.slice("/api/hanhwal/resources".length).split("/").filter(Boolean);
      const result=await service.handleHanhwalResource(request,segments);
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(Buffer.from(await result.arrayBuffer()));
    }
    res.writeHead(200,{"Content-Type":"text/html;charset=utf-8","Cache-Control":"no-store"});
    res.end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>한활 자료실 · 격리 검증</title><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script></html>');
  }catch{res.writeHead(400);res.end("Preview request failed");}
}).listen(port,"127.0.0.1",()=>console.log(origin+"/our-activities/hanhwal/resources?role=member"));
function assertFile(value){if(!(value instanceof File))throw Error("Missing file");}
