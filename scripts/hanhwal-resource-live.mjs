// Explicit opt-in: real storage/DB, synthetic local identities, exact-ID cleanup.
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
if (process.env.HANHWAL_LIVE_RESOURCE_TEST !== "true" || !process.argv[2]) throw Error("Explicit live-test opt-in and private config path required.");
const config = JSON.parse(await readFile(process.argv[2],"utf8"));
const origin = config.url, key = config.key || config.serviceRoleKey;
assert.equal(origin.replace(/\/$/,""),"https://okcabiimxuhhhokqajjg.supabase.co");
process.env.SUPABASE_URL=origin; process.env.SUPABASE_SERVICE_ROLE_KEY=key;
const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
const hash=b=>createHash("sha256").update(b).digest("hex");
const dir=await mkdtemp(resolve("node_modules/.hanhwal-live-")), made=[], results=[];
async function rest(path,init={}) {
  const r=await fetch(origin+"/rest/v1/"+path,{...init,headers:{...headers,...init.headers}});
  assert.ok(r.ok,`DB request failed ${r.status}`);
  const text=await r.text();return text?JSON.parse(text):null;
}
try {
  const fixture="globalThis.__hanhwalLiveActor";
  const mocks={
    "server-only":"",
    "next/server":'export { NextResponse } from "next/server.js";',
    "@/auth":`export const auth=async()=>({user:{name:"Isolated storage verifier",email:${fixture}.email}});`,
    "@/lib/hanhwalAccess":`export const getCurrentHanhwalAccess=async()=>${fixture};`,
    "@/lib/readOnlyDeveloperServer":"export async function assertDeveloperWriteAllowed() {}"
  };
  await build({entryPoints:["src/lib/hanhwalResources/server.ts"],outfile:join(dir,"live.mjs"),platform:"node",format:"esm",bundle:true,packages:"external",plugins:[{name:"synthetic-local-identity",setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:"fixture"}:undefined);b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:mocks[a.path],resolveDir:process.cwd()}));}}]});
  const api=await import(pathToFileURL(join(dir,"live.mjs")));
  const actor=role=>globalThis.__hanhwalLiveActor={email:role==="public"?"":role==="member"?"hanhwal-storage-test@example.invalid":"hanhwal-storage-admin@example.invalid",isOfficialMember:role!=="public",isAdmin:role==="admin"};
  const call=(method,segments=[],body)=>api.handleHanhwalResource(new Request("https://kline.test/api/hanhwal/resources/"+segments.join("/"),{method,headers:{Origin:"https://kline.test","Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}),segments);
  const pptx=(await rest("ecc_resource_files?select=storage_path,mime_type&status=eq.published&mime_type=eq.application%2Fvnd.openxmlformats-officedocument.presentationml.presentation&limit=1"))[0];
  assert.ok(pptx,"A real existing PPTX is required");
  const source=await fetch(origin+"/storage/v1/object/authenticated/ecc-resource-library/"+pptx.storage_path,{headers});
  assert.ok(source.ok);const pptBytes=Buffer.from(await source.arrayBuffer());
  const files=[
    {name:"verification.pdf",type:"application/pdf",bytes:await readFile("/tmp/hanhwal-test-original.pdf")},
    {name:"verification.hwp",type:"application/x-hwp",bytes:await readFile("/tmp/hanhwal-test-original.hwp")},
    {name:"verification.pptx",type:pptx.mime_type,bytes:pptBytes},
    {name:"verification.png",type:"image/png",bytes:await readFile("public/images/k-line-official-logo.png")}
  ];
  for(const file of files){
    actor("member");
    const initial=await call("POST",[],{title:"[ISOLATED STORAGE VERIFICATION] "+file.name,category:file.type.startsWith("image")?"photos":"archery",fileName:file.name,mimeType:file.type,sizeBytes:file.bytes.length});
    assert.equal(initial.status,201,await initial.clone().text());
    const ticket=await initial.json();made.push({id:ticket.id,path:ticket.storagePath});
    const form=new FormData();form.append("cacheControl","60");form.append("",new File([file.bytes],file.name,{type:file.type}));
    const uploaded=await fetch(ticket.signedUrl,{method:"PUT",headers:{"x-upsert":"false"},body:form});
    assert.ok(uploaded.ok,`Actual upload failed: ${uploaded.status} ${await uploaded.text()}`);
    const complete=await call("POST",[ticket.id,"publish"]);
    assert.equal(complete.status,200,await complete.clone().text());let resource=(await complete.json()).resource;
    assert.equal(resource.status,"pending");
    actor("public");assert.equal((await call("GET",[ticket.id,"file"])).status,404);
    actor("admin");
    const edit=await call("PATCH",[ticket.id],{title:resource.title,description:"Temporary private verification",category:resource.category,visibility:"staff",revision:resource.revision});
    assert.equal(edit.status,200);resource=(await edit.json()).resource;
    const approved=await call("POST",[ticket.id,"approve"],{revision:resource.revision});
    assert.equal(approved.status,200,await approved.clone().text());
    const redirect=await call("GET",[ticket.id,"file"]);
    assert.equal(redirect.status,302);
    const original=await fetch(redirect.headers.get("location"));assert.ok(original.ok);
    const restored=Buffer.from(await original.arrayBuffer());assert.equal(hash(restored),hash(file.bytes));
    const download=await call("GET",[ticket.id,"file"],undefined);
    assert.equal(download.status,302);
    actor("member");assert.equal((await call("GET",[ticket.id,"file"])).status,404);
    actor("public");assert.equal((await call("GET",[ticket.id,"file"])).status,404);
    const publicObject=await fetch(origin+"/storage/v1/object/public/hanhwal-resource-library/"+ticket.storagePath);
    assert.ok(!publicObject.ok,"Private storage must not allow public URL reads");
    results.push({file:file.name,id:ticket.id,bytes:file.bytes.length,sha256:hash(file.bytes),upload:true,verified:true,downloadHashMatch:true,anonymousDenied:true,ordinaryMemberStaffDenied:true});
    actor("admin");assert.equal((await call("DELETE",[ticket.id])).status,200);
  }
  console.log(JSON.stringify({project:"okcabiimxuhhhokqajjg",identityMode:"synthetic-local-role-context",files:results},null,2));
} finally {
  for(const item of made){
    const safe=await rest(`hanhwal_resource_files?id=eq.${item.id}&uploader_email=eq.hanhwal-storage-test%40example.invalid&select=id,storage_path`);
    if(!safe[0]||safe[0].storage_path!==item.path)throw Error("Cleanup identity mismatch");
    const removed=await fetch(origin+"/storage/v1/object/hanhwal-resource-library",{method:"DELETE",headers,body:JSON.stringify({prefixes:[item.path]})});
    assert.ok(removed.ok,"Storage cleanup failed");
    await rest(`hanhwal_resource_files?id=eq.${item.id}&uploader_email=eq.hanhwal-storage-test%40example.invalid`,{method:"DELETE"});
  }
  delete globalThis.__hanhwalLiveActor; await rm(dir,{recursive:true,force:true});
}
