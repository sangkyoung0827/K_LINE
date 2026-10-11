import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
import { mkdtemp, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

export const archiveTestOrigin = "http://archive-isolated.invalid";
export const archiveMigration = "20261011073509_event_archive_v2.sql";
const hash = b => createHash("sha256").update(b).digest("hex");
const tables = new Set(["items", "assets", "labels", "import_jobs", "links", "versions"].map(n => `event_archive_${n}`));
const json = (data, status = 200) => Response.json(data, { status });
function split(value) {
  const parts = []; let start = 0, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i]; if (escaped) { escaped = false; continue; } if (c === "\\") { escaped = true; continue; }
    if (c === '"') quoted = !quoted;
    if (!quoted) { if (c === "(") depth++; if (c === ")") depth--; if (c === "," && !depth) { parts.push(value.slice(start, i)); start = i + 1; } }
  }
  parts.push(value.slice(start)); return parts;
}
export async function archiveHarness() {
  const dir = await mkdtemp(join(tmpdir(), "kline-archive-qa-"));
  const db = new PGlite(join(dir, "postgres")); await db.waitReady;
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
    grant usage on schema storage to service_role;grant all on storage.buckets,storage.objects to service_role;`);
  await db.exec(await readFile(new URL(`../supabase/migrations/${archiveMigration}`, import.meta.url), "utf8"));
  await db.exec("set role service_role");
  const columns = new Map();
  for (const table of tables) columns.set(table, new Set((await db.query("select column_name from information_schema.columns where table_name=$1", [table])).rows.map(r => r.column_name)));
  const objects = new Map(), requests = [], control = { aiFail: false, storageFail: false, disconnect: false, key: "qa-only", email: "qa-admin@example.test", clubs: ["ecc","hanhwal","social_impact_union","unclassified"], readOnly: false,
    aiLabels: { suggestedClub: "ecc", itemType: "notice", title: "ECC cultural gathering", eventType: "gathering", eventDate: null, language: "ko/en", academicTerm: null, tags: ["ECC", "Culture"], summary: "A cultural exchange program.", confidence: 0.9 } };
  const env = { ...process.env }, nativeFetch = globalThis.fetch;
  Object.assign(process.env, { EVENT_ARCHIVE_ENABLED: "true", EVENT_ARCHIVE_ENVIRONMENT: "test", EVENT_ARCHIVE_TEST_SUPABASE_URL: archiveTestOrigin,
    EVENT_ARCHIVE_TEST_SUPABASE_SERVICE_ROLE_KEY: control.key, AUTH_SECRET: "archive-qa-token-secret", EVENT_AI_ENABLED: "true", EVENT_AI_PROVIDER: "openai",
    EVENT_AI_PRIMARY_MODEL: "gpt-6-luna", EVENT_AI_COMPLEX_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: "qa-not-real", GOOGLE_FORMS_TEST_SUPABASE_URL: "http://forms-isolated.invalid", GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: "qa-only", GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_", GOOGLE_FORMS_ENVIRONMENT: "test", GOOGLE_FORMS_AUTOMATION_ENABLED: "true" });
  globalThis.__archiveQA = control;
  const bundle = join(dir, "api.cjs");
  await build({ stdin: { contents: `export * from './src/lib/eventArchive/model';export * from './src/lib/eventArchive/integrity';export * from './src/lib/eventArchive/service';export * from './src/lib/eventArchive/ai';export * from './src/lib/eventArchive/access';export * from './src/lib/eventArchive/store';export {POST as ingestPOST} from './src/app/api/event-archive/ingest/route';export {GET as archiveGET,POST as archivePOST} from './src/app/api/event-archive/route';export {POST as connectorPOST} from './src/app/api/event-archive/connector/route';`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, packages: "external", platform: "node", format: "cjs", outfile: bundle,
    banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` }, plugins: [{ name: "isolated-identities", setup(b) {
      const mocks = { "server-only": "", "@/auth": "export async function auth(){return globalThis.__archiveQA.email?{user:{email:globalThis.__archiveQA.email}}:null}",
        "@/lib/admin": "export const normalizeEmail=e=>(e||'').trim().toLowerCase();export async function getAdminAccess(){return {isDeveloper:globalThis.__archiveQA.clubs.includes('unclassified'),isSuperAdmin:globalThis.__archiveQA.clubs.includes('unclassified'),isReadOnly:globalThis.__archiveQA.readOnly}}",
        "@/lib/eccAccess": "export async function getEccAccessForEmail(){return {isAdmin:globalThis.__archiveQA.clubs.includes('ecc')}}",
        "@/lib/hanhwalAccess": "export async function getHanhwalAccessForEmail(){return {isAdmin:globalThis.__archiveQA.clubs.includes('hanhwal')}}",
        "@/lib/supabaseServer": "export const cleanText=(v,n=240)=>typeof v==='string'?v.trim().slice(0,n):'';export async function supabaseRequest(){return globalThis.__archiveQA.clubs.includes('social_impact_union')?[{role:'admin'}]:[]}",
      };
      b.onResolve({ filter: /^(server-only|@\/auth|@\/lib\/(admin|eccAccess|hanhwalAccess|supabaseServer))$/ }, a => ({ path: a.path, namespace: "qa" }));
      b.onLoad({ filter: /.*/, namespace: "qa" }, a => ({ contents: mocks[a.path] }));
    } }] });
  const api = createRequire(import.meta.url)(bundle);
  async function rest(url, init = {}) {
    const resource = url.pathname.slice(9), body = init.body ? JSON.parse(init.body) : {};
    if (resource.startsWith("rpc/")) {
      const rpc = resource.slice(4), params = { event_archive_reserve: [body.p_actor, body.p_manifest, body.p_hash], event_archive_claim: [body.p_id,body.p_actor,body.p_token], event_archive_commit: [body.p_item, body.p_asset, body.p_token], event_archive_label_reserve: [body.p_id,body.p_actor] }[rpc];
      if (!params) throw new Error("UNKNOWN_RPC");
      return json((await db.query(`select public.${rpc}(${params.map((_,i)=>`$${i+1}`).join(",")}) as value`, params.map(p=>p && typeof p === "object" ? JSON.stringify(p) : p))).rows[0].value);
    }
    if (!tables.has(resource)) throw new Error("FORBIDDEN_TABLE");
    const args = [], allowed = columns.get(resource);
    const col = c => { if (!allowed.has(c)) throw new Error("FORBIDDEN_COLUMN"); return `"${c}"`; };
    const param = v => { args.push(v); return `$${args.length}`; };
    function predicate(expression) {
      const group = /^(and|or)\((.*)\)$/.exec(expression);
      if (group) return `(${split(group[2]).map(predicate).join(group[1] === "and" ? " and " : " or ")})`;
      const m = /^([a-z_]+)\.(eq|gte|lte|in|ilike|cs)\.(.*)$/s.exec(expression); if (!m) throw Error("UNSUPPORTED_FILTER");
      const c = col(m[1]), op = m[2], value = m[3];
      if (op === "in") return `${c} in (${split(value.slice(1,-1)).map(param).join(",")})`;
      if (op === "cs") return `${c} @> ${param(value)}::jsonb`;
      if (op === "ilike") { const text = value.slice(1,-1).replace(/\\([\\"])/g,"$1").replace(/(?<!\\)\*/g,"%"); return `${c} ilike ${param(text)}`; }
      return `${c} ${{eq:"=",gte:">=",lte:"<="}[op]} ${param(value)}`;
    }
    const filters = [];
    for (const [key,value] of url.searchParams) {
      if (["select","order","limit","offset","on_conflict"].includes(key)) continue;
      filters.push(predicate(key === "or" || key === "and" ? `${key}${value}` : `${key}.${value}`));
    }
    const where = filters.length ? ` where ${filters.join(" and ")}` : "";
    const method = init.method || "GET";
    if (method === "GET") {
      const select = url.searchParams.get("select") || "*";
      const order = url.searchParams.get("order"); const ordering = order ? ` order by ${order.split(",").map(s=>{ const [c,d]=s.split(".");if(!["asc","desc"].includes(d))throw Error();return `${col(c)} ${d}`; }).join(",")}` : "";
      const limit = Number(url.searchParams.get("limit") || 100), offset = Number(url.searchParams.get("offset") || 0);
      if (!Number.isInteger(limit) || !Number.isInteger(offset)) throw Error();
      // PGlite's scalar text decoder consumes a leading BOM. Read DB UTF-8 bytes
      // explicitly for originals so the harness mirrors PostgREST JSON decoding.
      const original = resource === "event_archive_items" && (select === "*" || select.split(",").includes("original_text"));
      const extra = original ? ",encode(convert_to(original_text,'UTF8'),'hex') as qa_original_hex" : "";
      const rows = (await db.query(`select ${select === "*" ? "*" : select.split(",").map(col).join(",")}${extra} from ${resource}${where}${ordering} limit ${limit} offset ${offset}`,args)).rows;
      if (original) for (const row of rows) {
        row.original_text = row.qa_original_hex === null ? null : new TextDecoder("utf-8", {fatal:true,ignoreBOM:true}).decode(Buffer.from(row.qa_original_hex,"hex"));
        delete row.qa_original_hex;
      }
      return json(rows);
    }
    const fields = Object.keys(body), names = fields.map(col), values = fields.map(f=>param(body[f] && typeof body[f]==="object"?JSON.stringify(body[f]):body[f]));
    let result;
    if (method === "POST") {
      const conflict = url.searchParams.get("on_conflict");
      result = await db.query(`insert into ${resource}(${names}) values(${values})${conflict ? ` on conflict (${conflict.split(",").map(col)}) do nothing` : ""} returning *`,args);
    } else if (method === "PATCH" && filters.length) result = await db.query(`update ${resource} set ${names.map((n,i)=>`${n}=${values[i]}`)}${where} returning *`,args);
    else throw Error("UNSUPPORTED_METHOD");
    return new Headers(init.headers).get("prefer")?.includes("return=representation") ? json(result.rows) : new Response(null,{status:204});
  }
  async function storeFetch(value, init = {}) {
    const url = new URL(value);
    if (url.pathname.startsWith("/rest/v1/")) {
      if (new Headers(init.headers).get("apikey") !== control.key) return json({},401);
      try { return await rest(url,init); } catch(e) { return json({message:e.message},400); }
    }
    const path = decodeURIComponent(url.pathname);
    if (path.startsWith("/storage/v1/object/upload/sign/event-assets/")) {
      const key = path.slice("/storage/v1/object/upload/sign/event-assets/".length);
      if (init.method === "POST") return json({url:`/object/upload/sign/event-assets/${key}?token=qa-upload`});
      if (objects.has(key)) return json({message:"Duplicate"},409);
      const bytes = Buffer.from(await new Response(init.body).arrayBuffer());
      await mkdir(join(dir,"objects"),{recursive:true}); const file = join(dir,"objects",hash(key)); await writeFile(file,bytes);objects.set(key,file);
      return json({key});
    }
    if (path.startsWith("/storage/v1/object/sign/event-assets/") && init.method === "POST") return json({signedURL:`/object/sign/event-assets/${path.slice("/storage/v1/object/sign/event-assets/".length)}?token=qa-read`});
    if (path === "/storage/v1/object/event-assets" && init.method === "DELETE") {
      for (const key of JSON.parse(init.body).prefixes) { if(objects.has(key)){await unlink(objects.get(key));objects.delete(key);} }return json({});
    }
    if (path.startsWith("/storage/v1/object/event-assets/") || path.startsWith("/storage/v1/object/sign/event-assets/")) {
      const key = path.split("event-assets/")[1];
      if (control.storageFail) return json({},503);
      if (!objects.has(key)) return json({},404);
      if (control.disconnect) throw Error("QA_DISCONNECT");
      return new Response(await readFile(objects.get(key)));
    }
    throw Error("UNKNOWN_STORAGE_OPERATION");
  }
  globalThis.fetch = async (value, init = {}) => {
    const url = String(value); requests.push({url,method:init.method || "GET"});
    if (url.startsWith(archiveTestOrigin)) return storeFetch(url,init);
    if (url.startsWith("http://forms-isolated.invalid/")) return url.includes("rpc") ? json("00000000-0000-4000-8000-000000000001") : new Response(null,{status:204});
    if (url === "https://api.openai.com/v1/responses") return control.aiFail ? json({},503) : json({status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(control.aiLabels)}]}]});
    throw Error("EXTERNAL_NETWORK_FORBIDDEN_IN_QA");
  };
  const access = () => ({email:control.email,clubs:control.clubs,superAdmin:control.clubs.includes("unclassified"),readOnly:control.readOnly});
  return {api,db,dir,objects,requests,control,access,fetch:storeFetch, async upload(prepared,files) {
    for(const u of prepared.uploads) {const r=await storeFetch(u.signedUrl,{method:"PUT",body:files[u.index]});if(!r.ok&&r.status!==409)throw Error("UPLOAD_FAILED");}
  }, async close(){globalThis.fetch=nativeFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);await db.close();} };
}
