import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";

export async function clubHarness({ liveAI = false } = {}) {
  const original = { ...process.env };
  const originalFetch = globalThis.fetch;
  const db = new PGlite();
  await db.exec("create table receipts(id text primary key, actor_email text, scope text, capability text, status text)");
  const state = { email: "qa-manager@example.test", scopes: ["ecc"], readOnly: false, developer: false, calls: [], decisions: [], aiCalls: 0,
    data: { registrations: [{ id: "qa-member", fullName: "테스트 회원", studentId: "001234", paymentConfirmed: true, adminNote: "Original note", email: "private@example.test" }] } };
  globalThis.__clubQA = state;
  process.env.AUTH_SECRET = "isolated-qa-signing-secret";
  process.env.EVENT_AI_OPENAI_API_KEY = liveAI ? original.OPENAI_API_KEY : "qa-key";
  globalThis.fetch = async (url, init) => {
    if (String(url) !== "https://api.openai.com/v1/responses") throw Error("NO_EXTERNAL_REQUESTS_ALLOWED");
    state.aiCalls++;
    if (liveAI) return originalFetch(url, init);
    const body = JSON.parse(init.body);
    state.lastPrompt = body;
    if (state.aiResponse) return Response.json(state.aiResponse);
    const decision = state.decisions.shift() || { action: "answer", capability: "", method: "GET", queryJson: "{}", bodyJson: "{}", format: "", answer: "조회한 자료를 확인했습니다." };
    return Response.json({ model: body.model, status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(decision) }] }] });
  };
  state.receipt = async (path, init = {}) => {
    if (!init.method && /^(ecc|hanhwal)_member_registrations\?/.test(path)) {
      const cursor = new URL("https://qa/" + path).searchParams.get("id")?.slice(3) || "";
      return state.data.registrations.filter(row => row.id > cursor).slice(0, 500).map(row => ({ id: row.id, full_name: row.fullName, student_id: row.studentId, google_email: row.email || "", department_or_major: "", nationality: "South Korea", gender: "Other", payment_confirmed: row.paymentConfirmed, official_member: row.paymentConfirmed, admin_note: row.adminNote, created_at: "2026-10-14T00:00:00Z", updated_at: "2026-10-14T00:00:00Z", kakao_display_name: "", kakao_id: "" }));
    }
    const body = JSON.parse(init.body || "{}");
    if (init.method === "POST") return (await db.query("insert into receipts values($1,$2,$3,$4,$5) on conflict do nothing returning id", [body.id, body.actor_email, body.scope, body.capability, body.status])).rows;
    if (init.method === "PATCH") { await db.query("update receipts set status=$1 where id=$2", [body.status, new URL("https://qa/" + path).searchParams.get("id").slice(3)]); return []; }
    throw Error("UNEXPECTED_STORE_ACCESS");
  };
  const dir = await mkdtemp(join(tmpdir(), "club-qa-"));
  await build({ stdin: { contents: `export * from './src/lib/woohyukmon/club-access'; export * from './src/lib/woohyukmon/club-service'; export * from './src/lib/woohyukmon/club-catalog'; export * from './src/lib/woohyukmon/club-documents'; export * from './src/lib/woohyukmon/operations/token'; export {GET,POST} from './src/app/api/woohyukmon/club-assistant/route'; export {GET as exportDocument} from './src/app/api/woohyukmon/club-assistant/export/route';`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, platform: "node", format: "cjs", packages: "external", outfile: join(dir, "api.cjs"),
    banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` },
    plugins: [{ name: "isolated-identities-and-routes", setup(b) {
      const mocks = {
        "server-only": "",
        "@/auth": "export async function auth(){return globalThis.__clubQA.email?{user:{email:globalThis.__clubQA.email}}:null}",
        "@/lib/admin": "export const normalizeEmail=e=>(e||'').trim().toLowerCase();export async function getAdminAccess(){const s=globalThis.__clubQA;return {isReadOnly:s.readOnly,isDeveloper:s.developer,isSuperAdmin:s.developer}}",
        "@/lib/eccAccess": "export async function getEccAccessForEmail(){return {isAdmin:globalThis.__clubQA.scopes.includes('ecc'),role:'admin'}}",
        "@/lib/hanhwalAccess": "export async function getHanhwalAccessForEmail(){return {isAdmin:globalThis.__clubQA.scopes.includes('hanhwal'),role:'super_admin'}}",
        "@/lib/siu/access": "export async function getCurrentSiuAccess(){return {isAdmin:globalThis.__clubQA.scopes.includes('social_impact_union'),role:'admin'}}",
        "@/lib/jeju/access": "export async function getJejuAccessForEmail(){return {isAdmin:globalThis.__clubQA.scopes.includes('jeju'),role:'jeju_admin'}}",
        "@/lib/research/server": "export async function getResearchEditorAccess(){return {canEdit:globalThis.__clubQA.scopes.includes('research')}}",
        "@/lib/supabaseServer": "export const cleanText=(v,n=240)=>typeof v==='string'?v.trim().slice(0,n):'';export async function supabaseRequest(p,i){return globalThis.__clubQA.receipt(p,i)}",
        "@/lib/woohyukmon/club-member-data": "export async function loadClubMembers(){return globalThis.__clubQA.data.registrations}"
      };
      b.onResolve({ filter: /^server-only$|^@\/(auth|lib\/)/ }, a => Object.hasOwn(mocks, a.path) ? { path: a.path, namespace: "mock" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "mock" }, a => ({ contents: mocks[a.path] }));
      b.onResolve({ filter: /^@\/app\/api\// }, a => a.path.includes("woohyukmon/club-assistant") ? undefined : { path: a.path, namespace: "route" });
      b.onLoad({ filter: /.*/, namespace: "route" }, a => ({ contents: `const resource=${JSON.stringify(a.path)};async function run(r){const s=globalThis.__clubQA;s.calls.push({resource,method:r.method,body:r.method==='GET'?null:await r.json(),url:r.url});return Response.json(s.data)};export const GET=run,POST=run,PATCH=run,DELETE=run;` }));
    } }] });
  const api = createRequire(import.meta.url)(join(dir, "api.cjs"));
  return { api, state, db, async close() { globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); delete globalThis.__clubQA; await db.close(); } };
}

export const decision = (action, capability, method = "GET", body = {}, query = {}, format = "") => ({ action, capability, method, bodyJson: JSON.stringify(body), queryJson: JSON.stringify(query), format, answer: "격리 검증 요청" });
export const qaRequest = body => new Request("http://127.0.0.1:3358/api/woohyukmon/club-assistant", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3358" }, body: JSON.stringify(body) });
