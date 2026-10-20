import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
export function loadResourceModule(file, mocks = {}, extra = {}, cache = new Map()) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const mod = {exports:{}};
  cache.set(file, mod.exports);
  const code = ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const read = name => Object.hasOwn(mocks,name) ? mocks[name] : name.startsWith("@/") || name.startsWith(".")
    ? loadResourceModule((name.startsWith("@/") ? resolve("src",name.slice(2)) : resolve(dirname(file),name)) + ".ts",mocks,extra,cache) : require(name);
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date,Buffer,Request,Response,Headers,URL,URLSearchParams,...extra})(read,mod,mod.exports);
  cache.set(file,mod.exports); return mod.exports;
}
export const uuid = "11111111-1111-4111-8111-111111111111";
export const row = () => ({id:uuid,title:"Archery lesson",description:"Training",category:"archery",file_name:"lesson.pdf",mime_type:"application/pdf",size_bytes:100,storage_path:`${uuid}/${uuid}.pdf`,uploader_email:"member@test.invalid",uploader_name:"Member",created_at:new Date().toISOString(),published_at:null,status:"pending",visibility:"public",revision:2});
export function resourceHarness() {
  const state = {access:{email:"",isOfficialMember:false,isAdmin:false},rows:[],calls:[],signed:[],deleted:[],header:true,stored:{sizeBytes:100,mimeType:"application/pdf"},readOnly:false};
  const storage = {
    createResourceUploadUrl:async path => { state.signed.push(path);return {signedUrl:"https://files.invalid/upload",token:"test",endpoint:"https://files.invalid/resumable"}; },
    inspectResourceFile:async()=>state.stored,verifyResourceHeader:async()=>state.header,
    createResourceReadUrl:async(path,name,download)=>{state.signed.push(path);return `https://files.invalid/${path}?download=${download}`;},
    deleteResourceFile:async path=>state.deleted.push(path)
  };
  const mocks = {
    "server-only":{},
    "@/auth":{auth:async()=>({user:{name:"Member"}})},
    "@/lib/hanhwalAccess":{getCurrentHanhwalAccess:async()=>state.access},
    "@/lib/readOnlyDeveloper":{isReadOnlyDeveloperEmail:()=>state.readOnly},
    "@/lib/clubResources/storage":{createResourceStorage:bucket=>{assert.equal(bucket,"hanhwal-resource-library");return storage;}},
    "next/server":{NextResponse:{json:(body,o={})=>new Response(JSON.stringify(body),{...o,headers:{"Content-Type":"application/json",...o.headers}}),redirect:(url,o={})=>new Response(null,{...o,headers:{Location:url,...o.headers}})}},
    "@/lib/supabaseServer":{
      cleanText:(v,n)=>typeof v==="string"?v.trim().slice(0,n):"",
      supabaseRequest:async(path,init={})=>{
        state.calls.push({path,init});
        assert.ok(path.startsWith("hanhwal_resource_files"),"Never query ECC storage");
        const q=new URLSearchParams(path.split("?")[1]), method=init.method||"GET";
        const matching=state.rows.filter(r=>["id","revision","status"].every(k=>!q.has(k)||!q.get(k).startsWith("eq.")||String(r[k])===q.get(k).slice(3)));
        if(method==="GET")return matching;
        if(method==="POST"){const r={...row(),...JSON.parse(init.body),revision:1};state.rows.push(r);return [r];}
        if(method==="PATCH"){matching.forEach(r=>Object.assign(r,JSON.parse(init.body)));return matching;}
        if(method==="DELETE"){state.rows=state.rows.filter(r=>!matching.includes(r));return [];}
        throw Error("Unexpected DB method");
      }
    }
  };
  const service=loadResourceModule("src/lib/hanhwalResources/server.ts",mocks);
  const call=(method="GET",segments=[],body,origin="https://kline.test")=>service.handleHanhwalResource(new Request("https://kline.test/api/hanhwal/resources/"+segments.join("/"),{
    method,headers:{Origin:origin,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)
  }),segments);
  return {state,call,service};
}
