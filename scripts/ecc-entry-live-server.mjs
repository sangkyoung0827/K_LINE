// Isolated real Google OIDC participant test. Not the production NextAuth session.
import { createServer } from "node:http";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import context from "./fixtures/ecc-entry-context.cjs";

const { web } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const origin = "http://localhost:3300";
const redirectUri = `${origin}/api/google-forms/oauth/callback`;
if (web.project_id !== "kline-forms-test" || !web.redirect_uris.includes(redirectUri)) throw new Error("Unexpected test OAuth client");
const db = JSON.parse(readFileSync("private/supabase-server.local.json", "utf8"));
const { encryptionKey } = JSON.parse(readFileSync("private/google-forms-oauth.local.json", "utf8"));
Object.assign(process.env, { GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test", GOOGLE_FORMS_TEST_ORIGIN: origin,
  GOOGLE_FORMS_TEST_SUPABASE_URL: db.url, GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: db.key, GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_",
  GOOGLE_TOKEN_ENCRYPTION_KEY: encryptionKey, GOOGLE_FORMS_CLIENT_ID: web.client_id, GOOGLE_FORMS_CLIENT_SECRET: web.client_secret,
  GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED: "true", GOOGLE_FORMS_SERVER_REVOCATION_ENABLED: "true", AUTH_SECRET: randomBytes(48).toString("base64url"),
  SUPABASE_URL: db.url, SUPABASE_SERVICE_ROLE_KEY: db.key,
});
delete process.env.VERCEL_ENV;
const dir = mkdtempSync(join(process.cwd(), "node_modules", ".ecc-entry-live-"));
const contextPath = resolve("scripts/fixtures/ecc-entry-context.cjs");
await build({ stdin: { contents: `export {GET,POST} from './src/app/api/google-forms/forms/[id]/entry/route'; export {revokeExpiredEccFormEntries} from './src/lib/googleForms/eccFormLeases'; export {listPermissions} from './src/lib/googleForms/eccResponderEntry'; export {googleFetch,createGoogleForm,setGoogleFormStatus} from './src/lib/googleForms/googleApi'; export {draftFromTemplate} from './src/lib/googleForms/templates'; export {getEccRoleRow} from './src/lib/eccAccess';`, resolveDir: process.cwd(), loader: "ts" }, outfile: join(dir,"backend.cjs"), bundle: true, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "isolated-session", setup(builder) {
  builder.onResolve({filter:/ecc-entry-context\.cjs$/},()=>({path:contextPath,external:true}));
  builder.onResolve({filter:/^@\/lib\/readOnlyDeveloperServer$/},()=>({path:"write-guard",namespace:"isolated-write"}));
  builder.onLoad({filter:/.*/,namespace:"isolated-write"},()=>({loader:"js",contents:`export async function assertDeveloperWriteAllowed(){throw new Error('Native member writes disabled in participant preview');}`}));
  builder.onResolve({filter:/^(server-only|@\/auth|next\/headers|@\/lib\/admin)$/},args=>({path:args.path,namespace:"isolated"}));
  builder.onLoad({filter:/.*/,namespace:"isolated"},args=>({loader:"js",contents:args.path==="@/auth" ? `const ctx=require(${JSON.stringify(contextPath)}); export async function auth(){const email=ctx.getStore()?.email;return email?{user:{email}}:null;}` : args.path==="next/headers" ? `const ctx=require(${JSON.stringify(contextPath)}); export async function cookies(){return {get:(name)=>{const value=ctx.getStore()?.cookies?.[name];return value?{value}:undefined;}};}` : args.path==="@/lib/admin" ? `export const normalizeEmail=v=>(v||"").trim().toLowerCase(); export async function getAdminAccess(){return {isDeveloper:false,isSuperAdmin:false};}` : ""}));
  builder.onResolve({filter:/^@\/lib\/eccAccess$/},()=>({path:"role",namespace:"role"}));
  builder.onLoad({filter:/.*/,namespace:"role"},()=>({loader:"js",resolveDir:process.cwd(),contents:`const ctx=require(${JSON.stringify(contextPath)});import {getEccRoleRow as realRole} from './src/lib/eccAccess';export async function getEccRoleRow(email,strict){if(ctx.getStore()?.outage&&email==='samgkyoung1004@gmail.com')throw new TypeError('CONTROLLED_TEST_LOOKUP_OUTAGE');return realRole(email,strict);}`}));
} }] });
const backend = (await import(pathToFileURL(join(dir,"backend.cjs")).href)).default;
const expected = "samgkyoung1004@gmail.com";
const owner = "waterfallingsound0827@gmail.com";
let form = await backend.createGoogleForm(backend.draftFromTemplate("ecc", "ecc_gathering", "[KLINE PRIVATE FINAL TEST] ECC International Gathering"), owner, randomUUID());
const permissionBase = `https://www.googleapis.com/drive/v3/files/${form.google_form_id}/permissions`;
for (const item of await backend.listPermissions(form.google_form_id)) {
  if (item.type === "anyone" && item.role === "reader" && item.view === "published") await backend.googleFetch(`${permissionBase}/${encodeURIComponent(item.id)}`,{method:"DELETE"});
  else if (item.type !== "user") throw new Error("Unexpected broad test access");
}
if ((await backend.listPermissions(form.google_form_id)).some(item=>item.type!=="user")) throw new Error("Test form not restricted");
process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED = "true";
form = await backend.setGoogleFormStatus(form,"open");
delete process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED;
writeFileSync("private/ecc-entry-final-preview.local.json",JSON.stringify({id:form.id,googleFormId:form.google_form_id,url:`${origin}/`,responderUrl:form.responder_url,createdAt:new Date().toISOString()}),{mode:0o600});
await build({entryPoints:["scripts/fixtures/ecc-entry-live-ui.tsx"],outfile:join(dir,"ui.js"),bundle:true,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"link",setup(builder){builder.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"ui"}));builder.onLoad({filter:/.*/,namespace:"ui"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:`import React from 'react';export default function Link({children,...props}){return <a {...props} href={props.href.startsWith('/login')?'/sign-in':props.href}>{children}</a>}`}));}}]});
execFileSync("node",["node_modules/tailwindcss/lib/cli.js","-i","src/app/globals.css","-o",join(dir,"ui.css")],{stdio:"ignore"});
const sessions = new Map();
const flows = new Map();
const cookieMap = req => Object.fromEntries((req.headers.cookie||"").split(";").map(value=>value.trim().split("=")).filter(parts=>parts.length===2));
const worker = async()=> {try{return await backend.revokeExpiredEccFormEntries();}catch{return {retry:1};}};
await worker();
let working = false;
const timer = setInterval(async()=>{if(working)return;working=true;try{await worker();}finally{working=false;}},30_000);
createServer(async(req,res)=>{
  const json=(value,status=200)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(value));};
  const redirect=(to,cookie)=>{res.writeHead(303,{Location:to,...(cookie?{"Set-Cookie":cookie}:{}),"Cache-Control":"no-store"});res.end();};
  if(req.headers.host!=="localhost:3300")return json({error:"Invalid host"},403);
  const url = new URL(req.url,origin);
  const cookies=cookieMap(req);
  const session=sessions.get(cookies.ecc_entry_test);
  const email=session?.expires>Date.now()?session.email:undefined;
  try {
    if(url.pathname==="/sign-in") {
      const state=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");
      flows.set(state,{verifier,expires:Date.now()+600_000});
      const params=new URLSearchParams({client_id:web.client_id,redirect_uri:redirectUri,response_type:"code",scope:"openid email",login_hint:expected,prompt:"select_account",state,code_challenge:createHash("sha256").update(verifier).digest("base64url"),code_challenge_method:"S256"});
      return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`,`ecc_entry_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`);
    }
    if(url.pathname==="/api/google-forms/oauth/callback") {
      const state=url.searchParams.get("state"),flow=flows.get(state);flows.delete(state);
      if(!flow||flow.expires<Date.now()||cookies.ecc_entry_state!==state||!url.searchParams.get("code"))return json({error:"LOGIN_STATE_REJECTED"},400);
      const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",signal:AbortSignal.timeout(20_000),body:new URLSearchParams({client_id:web.client_id,client_secret:web.client_secret,redirect_uri:redirectUri,code:url.searchParams.get("code"),code_verifier:flow.verifier,grant_type:"authorization_code"})});
      const tokens=await tokenResponse.json();
      if(!tokenResponse.ok||!tokens.access_token)return json({error:"LOGIN_EXCHANGE_FAILED"},400);
      const profileResponse=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(20_000)});
      const profile=await profileResponse.json();
      if(!profileResponse.ok||profile.email!==expected||profile.email_verified!==true)return json({error:"Please sign in as samgkyoung1004@gmail.com"},403);
      const sid=randomBytes(32).toString("base64url");sessions.set(sid,{email:expected,expires:Date.now()+3600_000});
      console.log("Verified Google participant login; no native member writes.");
      return redirect("/",`ecc_entry_test=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`);
    }
    const apiPath=url.pathname.match(/^\/api\/google-forms\/forms\/([0-9a-f-]{36})\/entry$/);
    if(apiPath) {
      if(apiPath[1]!==form.id||!["GET","POST"].includes(req.method))return json({error:"Not found"},404);
      let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>1000)return json({error:"Too large"},413);}
      const request=new Request(url,{method:req.method,headers:{origin:req.headers.origin||"","content-type":"application/json"},...(req.method==="POST"?{body:raw||"{}"}:{})});
      const result=await context.run({email,cookies,outage: cookies.ecc_entry_scenario==="outage"},()=>backend[req.method](request,{params:Promise.resolve({id:form.id})}));
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(await result.text());
    }
    if(["/ui.js","/ui.css"].includes(url.pathname)){res.writeHead(200,{"Content-Type":url.pathname.endsWith("css")?"text/css":"text/javascript"});return res.end(readFileSync(join(dir,url.pathname.slice(1))));}
    if(url.pathname==="/images/woohyukmon-icon.png"){res.writeHead(200,{"Content-Type":"image/png"});return res.end(readFileSync("public/images/woohyukmon-icon.png"));}
    if(url.pathname!=="/")return json({error:"Not found"},404);
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Set-Cookie":`ecc_entry_scenario=${url.searchParams.get("scenario")==="outage"?"outage":"normal"}; HttpOnly; SameSite=Strict; Path=/`,"Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'"});
    res.end(`<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ECC 활동 신청 · 비공개 최종 테스트</title><link rel="stylesheet" href="/ui.css"><body><div id="root" data-form-id="${form.id}"></div><script src="/ui.js"></script></body></html>`);
  }catch{json({error:"TEST_REQUEST_FAILED"},503);}
}).listen(3300,"127.0.0.1",()=>console.log(`Live restricted participant preview: ${origin}; actual Google OIDC/DB/Forms, NOT production NextAuth.`));
async function cleanup(){clearInterval(timer);try{await backend.setGoogleFormStatus(form,"draft");}catch{}process.exit();}
process.on("SIGTERM",cleanup);process.on("SIGINT",cleanup);
