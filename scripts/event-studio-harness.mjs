import { build } from "esbuild";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createPreviewStore, previewOrigin } from "./event-studio-test-store.mjs";

export function fixturePlan(clubKey = "ecc") {
  return { clubKey, title: "[QA ONLY] Cultural exchange", descriptionKo: "함께 문화를 배우고 대화하는 체험 제안입니다.", descriptionEn: "A proposal to learn about culture and share conversations.",
    noticeKo: "문화교류 체험 공지\n서로의 문화를 배우고 이야기를 나누는 시간을 제안합니다. 자신이 소개하고 싶은 문화 이야기를 생각해보세요.\n제안 프로그램\n먼저 서로 인사하고, 작은 그룹에서 각자의 문화 이야기를 나눈 뒤 인상 깊었던 내용을 함께 돌아봅니다.\n일정 및 장소\n2026-11-07T18:00:00+09:00, QA Library, 30명\n신청 안내\n2026-11-06T18:00:00+09:00까지 이름을 작성하고 선택적으로 경험을 알려주세요.",
    noticeEn: "Cultural exchange notice\nWe propose an opportunity to learn about one another's cultures through conversation. Think about a cultural story you would like to share.\nProposed program\nStart with introductions, share cultural stories in small groups, then reflect together on what stood out.\nSchedule and venue\n2026-11-07T18:00:00+09:00, QA Library, 30 people\nApplication\nApply by 2026-11-06T18:00:00+09:00 with your name and optionally tell us about your experience.",
    activityDate: "2026-11-07T18:00:00+09:00", applicationDeadline: "2026-11-06T18:00:00+09:00", location: "QA Library", capacity: 30,
    questions: [{ id: "name", title: "Name / 이름", type: "short_answer", required: true, options: [] },
      { id: "experience", title: "Experience / 경험", type: "multiple_choice", required: false, options: ["First time / 처음", "Experienced / 경험 있음"] }],
    missingInformation: [], requiresReview: true };
}
export const fixtureMessage = "문화교류 체험. 행사 2026-11-07T18:00:00+09:00, 마감 2026-11-06T18:00:00+09:00, 장소 QA Library, 30명";
export async function eventHarness(options = {}) {
  const control = { email: "qa-admin@example.test", clubs: ["ecc", "hanhwal", "social_impact_union"], readOnly: false,
    aiCalls: 0, externalCreates: 0, failNotice: false, failGoogle: false, failOAuth: false, missingUrl: false,
    aiStatus: 200, outputs: [], currentPlan: fixturePlan(), remoteForms: new Map(), requests: [] };
  globalThis.__studioQA = control;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const liveOpenAI = options.liveOpenAI === true;
  if (liveOpenAI && (originalEnv.WOOHYUKMON_PREVIEW_OPENAI_ENABLED !== "true" || !/^sk-/.test(originalEnv.OPENAI_API_KEY || ""))) throw Error("LIVE_OPENAI_APPROVAL_AND_KEY_REQUIRED");
  Object.assign(process.env, { AUTH_SECRET: "qa-only-event-studio-approval-secret", GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
    GOOGLE_FORMS_TEST_SUPABASE_URL: previewOrigin, GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: "qa-db-only", GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_",
    GOOGLE_FORMS_CLIENT_ID: "qa-client", GOOGLE_FORMS_CLIENT_SECRET: "qa-secret", GOOGLE_FORMS_TEST_ORIGIN: "http://127.0.0.1:3346",
    GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), EVENT_AI_ENABLED: "true", EVENT_AI_PROVIDER: "openai",
    EVENT_AI_PRIMARY_MODEL: "gpt-6-luna", EVENT_AI_COMPLEX_MODEL: "gpt-6.1-sol", OPENAI_API_KEY: liveOpenAI ? originalEnv.OPENAI_API_KEY : "qa-only-not-a-real-key" });
  delete process.env.VERCEL_ENV;
  delete process.env.GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED;
  const store = await createPreviewStore({ mediaDir: await mkdtemp(join(tmpdir(), "studio-qa-media-")), googleForms: true });
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith(previewOrigin)) {
      if (control.failNotice && url.includes("/club_board_posts")) throw new Error("QA_NOTICE_FAILURE");
      if (control.failNotice && url.includes("kline_forms_test_club_board_posts") && init.method === "POST") return Response.json({}, { status: 503 });
      return store.fetch(url, init);
    }
    if (url === "https://api.openai.com/v1/responses") {
      control.aiCalls++; const input = JSON.parse(init.body); control.requests.push(input);
      if (liveOpenAI) return originalFetch(url, init);
      if (control.aiStatus !== 200) return Response.json({ error: { message: "QA failure" } }, { status: control.aiStatus });
      const output = control.outputs.shift() ?? JSON.stringify({ ...control.currentPlan });
      return Response.json({ status: "completed", model: input.model, usage: { input_tokens: 1000, output_tokens: 500 }, output: [{ type: "message", content: [{ type: "output_text", text: output }] }] });
    }
    if (url === "https://oauth2.googleapis.com/token") return Response.json(control.failOAuth ? { error: "invalid_grant" } : { access_token: "qa-only-access" }, { status: control.failOAuth ? 400 : 200 });
    if (url.endsWith("?unpublished=true")) {
      control.externalCreates++;
      if (control.failGoogle) throw new Error("QA_CREATE_TIMEOUT");
      const formId = `qa${randomUUID().replaceAll("-", "")}`;
      const form = { formId, info: JSON.parse(init.body).info, responderUri: `https://docs.google.com/forms/d/e/${formId}/viewform`, items: [], publishSettings: { publishState: {} } };
      control.remoteForms.set(formId, form); return Response.json(form);
    }
    if (url.startsWith("https://forms.googleapis.com/v1/forms/")) {
      const id = new URL(url).pathname.split("/").at(-1).split(":")[0]; const form = control.remoteForms.get(id);
      if (!form) throw new Error("QA_FORM_NOT_FOUND");
      if (url.endsWith(":batchUpdate")) {
        for (const r of JSON.parse(init.body).requests) {
          if (r.createItem) form.items.splice(r.createItem.location.index, 0, r.createItem.item);
          if (r.updateFormInfo) form.info.description = r.updateFormInfo.info.description;
        }
      }
      if (url.endsWith(":setPublishSettings")) form.publishSettings = JSON.parse(init.body).publishSettings;
      return Response.json({ ...form, responderUri: control.missingUrl ? undefined : form.responderUri });
    }
    throw new Error("QA_UNEXPECTED_EXTERNAL_REQUEST");
  };
  const dir = await mkdtemp(join(tmpdir(), "studio-qa-bundle-"));
  await build({ stdin: { contents: `export * from './src/lib/eventStudio/model'; export * from './src/lib/eventStudio/ai'; export * from './src/lib/eventStudio/service'; export * from './src/lib/eventStudio/access'; export {POST} from './src/app/api/event-studio/route'; export {createSignedWoohyukmonPayload} from './src/lib/woohyukmon/operations/token'; export {encryptGoogleToken} from './src/lib/googleForms/crypto';`, resolveDir: process.cwd(), loader: "ts" },
    outfile: join(dir, "backend.cjs"), bundle: true, packages: "external", platform: "node", format: "cjs",
    banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` },
    plugins: [{ name: "qa-identities", setup(b) {
      const sources = {
        "server-only": "",
        "@/auth": "export async function auth(){return globalThis.__studioQA.email?{user:{email:globalThis.__studioQA.email}}:null}",
        "@/lib/admin": "export const normalizeEmail=(e)=>(e||'').trim().toLowerCase(); export async function getAdminAccess(){return {isReadOnly:globalThis.__studioQA.readOnly,isSuperAdmin:globalThis.__studioQA.clubs.length===3}}",
        "@/lib/eccAccess": "export async function getEccAccessForEmail(){return {isAdmin:globalThis.__studioQA.clubs.includes('ecc')}}; export async function getEccRoleRow(){throw Error('PRIVATE_MEMBER_READ_NOT_ALLOWED')}",
        "@/lib/eccAccessRetry": "export function isTemporaryEccLookupError(){return false}",
        "@/lib/hanhwalAccess": "export async function getHanhwalAccessForEmail(){return {isAdmin:globalThis.__studioQA.clubs.includes('hanhwal')}}",
        "@/lib/supabaseServer": "export const cleanText=(v,n=240)=>typeof v==='string'?v.trim().slice(0,n):'';export async function supabaseRequest(){return globalThis.__studioQA.clubs.includes('social_impact_union')?[{role:'admin'}]:[]}",
      };
      b.onResolve({ filter: /^(server-only|@\/auth|@\/lib\/(admin|eccAccess|eccAccessRetry|hanhwalAccess|supabaseServer))$/ }, a => ({ path: a.path, namespace: "qa" }));
      b.onLoad({ filter: /.*/, namespace: "qa" }, a => ({ contents: sources[a.path] }));
    } }] });
  const api = createRequire(import.meta.url)(join(dir, "backend.cjs"));
  const refresh = api.encryptGoogleToken("qa-only-refresh");
  await store.db.query("insert into kline_forms_test_google_oauth_connections(id,account_email,encrypted_refresh_token,scopes,connected_by) values('operations','qa-owner@example.test',$1,ARRAY['https://www.googleapis.com/auth/forms.body'],'qa-admin@example.test')", [refresh]);
  const access = () => ({ email: control.email, manageableClubs: control.clubs, readOnly: control.readOnly, canSetLimits: true });
  return { api, control, store, access, async close() {
    globalThis.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); await store.db.close();
  } };
}
