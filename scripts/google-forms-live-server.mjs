// Isolated loopback test operator, verified from the existing Google OAuth grant.
// Uses real gateway/Google/REST modules, but does NOT verify Next.js login/session.
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const { web } = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (web.project_id !== "kline-forms-test") throw new Error("Wrong test Google project");
const db = JSON.parse(readFileSync("private/supabase-server.local.json", "utf8"));
const { encryptionKey } = JSON.parse(readFileSync("private/google-forms-oauth.local.json", "utf8"));
Object.assign(process.env, {
  GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
  GOOGLE_FORMS_TEST_ORIGIN: "http://localhost:3300", GOOGLE_FORMS_TEST_SUPABASE_URL: db.url,
  GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: db.key, GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_",
  GOOGLE_TOKEN_ENCRYPTION_KEY: encryptionKey, GOOGLE_FORMS_CLIENT_ID: web.client_id,
  GOOGLE_FORMS_CLIENT_SECRET: web.client_secret, AUTH_SECRET: randomBytes(48).toString("base64url")
});
delete process.env.VERCEL_ENV;
delete process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED;
delete process.env.GOOGLE_FORMS_TEST_NOTICE_PUBLICATION_APPROVED;
const actor = "waterfallingsound0827@gmail.com";
const temp = mkdtempSync(join(process.cwd(), "node_modules", ".kline-live-forms-"));
const isolated = { name: "loopback-operator", setup(builder) {
  builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "isolated" }));
  builder.onResolve({ filter: /^(\.\/access|@\/lib\/googleForms\/access)$/ }, () => ({ path: "access", namespace: "isolated" }));
  builder.onResolve({ filter: /^@\/lib\/admin$/ }, () => ({ path: "admin", namespace: "isolated" }));
  builder.onResolve({ filter: /^@\/lib\/supabaseServer$/ }, () => ({ path: "clean", namespace: "isolated" }));
  builder.onLoad({ filter: /.*/, namespace: "isolated" }, args => ({ loader: "js", contents: args.path === "access" ? `
    export class GoogleFormsAuthorizationError extends Error { constructor(message,status) { super(message); this.status=status; } }
    export async function getGoogleFormsAccess() { return {email:${JSON.stringify(actor)},authenticated:true,canConnect:false,isReadOnly:false,manageableClubs:['ecc']}; }
    export function assertClubAccess(a,club,write) { if(!a.authenticated||club!=='ecc'||(write&&a.isReadOnly)) throw new GoogleFormsAuthorizationError('FORBIDDEN',403); }
  ` : args.path === "admin" ? 'export const normalizeEmail = value => (value||"").trim().toLowerCase();' : args.path === "clean" ? 'export const cleanText = (value,max=240) => typeof value === "string" ? value.trim().slice(0,max) : "";' : "" }));
} };
await build({ stdin: { contents: `export { handleGoogleFormsOperation } from './src/lib/googleForms/gateway'; export { supabaseRequest } from './src/lib/googleForms/store'; export { getGoogleConnectionStatus,registryColumns } from './src/lib/googleForms/googleApi'; export { decryptGoogleToken } from './src/lib/googleForms/crypto'; export { draftFromTemplate } from './src/lib/googleForms/templates';`, resolveDir: process.cwd(), loader: "ts" }, outfile: join(temp,"backend.cjs"), bundle:true,platform:"node",format:"cjs",packages:"external",plugins:[isolated] });
const { handleGoogleFormsOperation, supabaseRequest, getGoogleConnectionStatus, registryColumns, decryptGoogleToken, draftFromTemplate } = (await import(pathToFileURL(join(temp,"backend.cjs")).href)).default;
// Read the encrypted grant via the real prefixed REST store; validate its identity independently.
const connections = await supabaseRequest("google_oauth_connections?id=eq.operations&select=account_email,encrypted_refresh_token&limit=1");
if (connections[0]?.account_email !== actor) throw new Error("Wrong DB OAuth account");
const tokensResponse = await fetch("https://oauth2.googleapis.com/token",{ method:"POST",signal:AbortSignal.timeout(20_000),body:new URLSearchParams({client_id:web.client_id,client_secret:web.client_secret,refresh_token:decryptGoogleToken(connections[0].encrypted_refresh_token),grant_type:"refresh_token"}) });
const tokens = await tokensResponse.json();
if (!tokensResponse.ok||!tokens.access_token) throw new Error("OAuth refresh failed");
const profileResponse=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(20_000)});
const profile=await profileResponse.json();
if(!profileResponse.ok||profile.email!==actor||profile.email_verified!==true) throw new Error("Test operator verification failed");
await build({entryPoints:["scripts/fixtures/google-forms-live-ui.tsx"],outfile:join(temp,"ui.js"),bundle:true,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'},plugins:[{name:"link",setup(builder){builder.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"ui"}));builder.onLoad({filter:/.*/,namespace:"ui"},()=>({loader:"tsx",resolveDir:process.cwd(),contents:'import React from "react"; export default function Link({children,...props}) {return <a {...props}>{children}</a>}'}));}}]});
execFileSync("node",["node_modules/tailwindcss/lib/cli.js","-i","src/app/globals.css","-o",join(temp,"ui.css")],{stdio:"ignore"});
const origin="http://127.0.0.1:3318";
const session=randomBytes(32).toString("hex");
const cookieMatches=value=>{const given=Buffer.from(value||"");const expected=Buffer.from(session);return given.length===expected.length&&timingSafeEqual(given,expected);};
createServer(async(request,response)=>{
  const send=(value,status=200)=>{response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify(value));};
  if(request.headers.host!=="127.0.0.1:3318") return send({error:"Invalid host"},403);
  const url=new URL(request.url,origin);
  try {
    if(url.pathname==="/ui.js"||url.pathname==="/ui.css") {response.writeHead(200,{"Content-Type":url.pathname.endsWith("css")?"text/css":"text/javascript"});return response.end(readFileSync(join(temp,url.pathname.slice(1))));}
    if(url.pathname.startsWith("/api/")) {
      const cookie=request.headers.cookie?.split("; ").find(v=>v.startsWith("kline_live_test="))?.split("=")[1];
      if(!cookieMatches(cookie)||(request.method!=="GET"&&request.headers.origin!==origin)) return send({error:"Test session/origin rejected"},403);
      if(url.pathname==="/api/google-forms/forms"&&request.method==="GET") return send({access:{manageableClubs:["ecc"]},connection:await getGoogleConnectionStatus(),forms:await supabaseRequest(`google_forms?select=${registryColumns}&club_key=eq.ecc&order=created_at.desc`)});
      let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>100_000)return send({error:"Too large"},413);}
      const input=JSON.parse(raw||"{}");
      const command=url.pathname==="/api/google-forms/forms"?{action:"DRAFT_GOOGLE_FORM",draft:draftFromTemplate(input.clubKey,input.templateId,input.title)}:input;
      const result=await handleGoogleFormsOperation(command);
      if(!result)return send({error:"Unrecognized Forms command"},400);
      return send(await result.json(),result.status);
    }
    if(url.pathname!=="/")return send({error:"Not found"},404);
    response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Set-Cookie":`kline_live_test=${session}; HttpOnly; SameSite=Strict; Path=/`,"Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'","Referrer-Policy":"no-referrer"});
    response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>우혁몬 · 실제 Google Forms 비공개 테스트</title><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>');
  }catch(error){send({error:error.message},500);}
}).listen(3318,"127.0.0.1",()=>console.log(`Verified loopback operator: ${origin}; real Google/REST, NOT normal Next.js authentication.`));
