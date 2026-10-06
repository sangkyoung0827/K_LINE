import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import { webcrypto } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
const json = (value) => JSON.parse(JSON.stringify(value));
function harness(envOverrides = {}) {
  const tables = { google_form_creation_attempts: [], google_forms: [], google_form_responses: [], google_form_workflows: [], club_board_posts: [], google_form_operation_audit: [], ecc_form_entry_leases: [], ecc_form_revoker_health: [] };
  const control = { canWrite: true, authenticated: true, externalCreates: 0, failSetup: false, missingUrl: false, failNotice: false, uncertain: false, pages: [], form: { formId: "remote123", responderUri: "https://docs.google.com/forms/d/e/real-response/viewform", items: [] } };
  async function store(path, init = {}) {
    if (path.startsWith("rpc/")) {
      const input = JSON.parse(init.body);
      control.formLocks ||= new Set();
      if (path === "rpc/ecc_form_lock") { if (control.formLocks.has(input.p_form_id)) return null; control.formLocks.add(input.p_form_id); return "lock-token"; }
      if (path === "rpc/ecc_form_unlock") { control.formLocks.delete(input.p_form_id); return true; }
      throw new Error("Unknown RPC");
    }
    const [table, query = ""] = path.split("?");
    if (table === "google_oauth_connections") return [{ account_email: "test@example.test", encrypted_refresh_token: "encrypted", scopes: [] }];
    if (table === "site_members") return [];
    const params = new URLSearchParams(query);
    const rows = tables[table];
    if (!rows) throw new Error(`Unexpected table ${table}`);
    const selected = rows.filter((row) => [...params].every(([key, value]) => value.startsWith("eq.") ? String(row[key]) === value.slice(3) : value.startsWith("in.(") ? value.slice(4,-1).split(",").includes(row[key]) : value.startsWith("lte.") ? Date.parse(row[key]) <= Date.parse(value.slice(4)) : true));
    if (init.method === "PATCH") { const body = JSON.parse(init.body); selected.forEach((row) => Object.assign(row, body)); return json(selected); }
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      if (table === "club_board_posts" && control.failNotice) throw new Error("NOTICE_TEST_FAILURE");
      const conflict = params.get("on_conflict")?.split(",") || (table === "google_form_creation_attempts" ? ["idempotency_key"] : []);
      const existing = conflict.length ? rows.find((row) => conflict.every((key) => row[key] === body[key])) : undefined;
      if (existing) { if (init.headers?.Prefer?.includes("merge-duplicates")) Object.assign(existing, body); else if (!params.has("on_conflict")) throw new Error("CONFLICT"); return []; }
      const row = { id: webcrypto.randomUUID(), revision: 1, workflow_status: "draft", form_registry_id: null, notice_id: null, remote_form_id: null, ...body };
      rows.push(row); return json([row]);
    }
    return json(selected);
  }
  const stubs = {
    "@/auth": { auth: async () => control.memberLoggedOut ? null : ({ user: { email: "member@example.test" } }) },
    "next/headers": { cookies: async () => ({ get: () => control.entryToken ? ({ value: control.entryToken }) : undefined }) },
    "@/lib/eccAccess": { getEccRoleRow: async (email, strict) => { assert.equal(strict, true); if (control.memberLookupError) throw control.memberLookupError; return control.memberRole || null; } },
    "@/lib/eccAccessRetry": { isTemporaryEccLookupError: error => error?.message === "transient" },
    "server-only": {}, "@/lib/googleForms/store": { supabaseRequest: store },
    "@/lib/googleForms/crypto": { decryptGoogleToken: () => "test-refresh" },
    "@/lib/googleForms/safety": { assertGoogleFormsTestEnvironment: () => {}, assertGoogleFormsPublicationApproval: () => {}, assertGoogleFormsNoticePublicationApproval: () => { throw new Error("PUBLIC_NOTICE_PUBLICATION_REQUIRES_SEPARATE_APPROVAL"); } },
    "@/lib/googleForms/access": {
      GoogleFormsAuthorizationError: class extends Error { constructor(message, status) { super(message); this.status = status; } },
      getGoogleFormsAccess: async () => ({ email: "admin@example.test", authenticated: control.authenticated, manageableClubs: control.manageableClubs ?? ["ecc"], isReadOnly: !control.canWrite }),
      assertClubAccess: (access, club, write) => {
        const ErrorType = stubs["@/lib/googleForms/access"].GoogleFormsAuthorizationError;
        if (!access.authenticated) throw new ErrorType("LOGIN_REQUIRED", 401);
        if (!access.manageableClubs.includes(club)) throw new ErrorType("FORBIDDEN", 403);
        if (write && !control.canWrite) throw new ErrorType("READ_ONLY", 403);
      }
    },
    "@/lib/admin": { normalizeEmail: (value) => (value || "").trim().toLowerCase() },
    "@/lib/supabaseServer": { cleanText: (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "" }
  };
  const fetch = async (url, init = {}) => {
    if (url === "https://kline-nine-wheat.vercel.app/api/woohyukmon") {
      control.existingAiCalls = (control.existingAiCalls || 0) + 1;
      const body = JSON.parse(init.body);
      assert.deepEqual(body.history, []);
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.headers.Cookie, undefined);
      assert.equal(init.redirect, "error");
      if (control.failExistingAi) return Response.json({ error: "unavailable" }, { status: 500 });
      return Response.json({ answer: JSON.stringify(control.aiDraft), provider: "nvidia" });
    }
    if (url === "https://integrate.api.nvidia.com/v1/chat/completions") {
      control.aiCalls = (control.aiCalls || 0) + 1;
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(control.aiDraft) } }] });
    }
    if (url.startsWith("https://test-db.example.test/rest/v1/ecc_activity_statuses?")) {
      assert.equal(init.method, undefined);
      return Response.json([{ gathering_open_days: control.gatheringDays ?? ["wednesday"] }]);
    }
    if (url.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "test-access" });
    if (url.startsWith("https://www.googleapis.com/drive/v3/files/")) {
      control.permissionCalls = (control.permissionCalls || 0) + 1;
      const permissions = control.permissions ||= [];
      if (!init.method || init.method === "GET") return Response.json({ permissions });
      if (control.permissionApiError) throw new Error("DRIVE_UNAVAILABLE");
      if (init.method === "DELETE") { control.revokedPermissions = (control.revokedPermissions || 0) + 1; const id = new URL(url).pathname.split("/").at(-1); control.permissions = permissions.filter(p => p.id !== id); return Response.json({}); }
      const input = JSON.parse(init.body);
      if (control.unsupportedExpiry && input.expirationTime) throw new Error("EXPIRY_NOT_SUPPORTED");
      const created = init.method === "PATCH" ? permissions.find(p => p.id === new URL(url).pathname.split("/").at(-1)) : { id: `permission-${permissions.length}`, ...input };
      if (init.method === "POST") permissions.push(created);
      if (init.method === "PATCH") Object.assign(created, input);
      if (url.includes("removeExpiration=true") || control.ignoredExpiry) delete created.expirationTime;
      return Response.json(created);
    }
    if (url.includes("/responses?")) return Response.json(control.pages.shift() || { responses: [] });
    if (url.endsWith("?unpublished=true")) { control.externalCreates++; if (control.uncertain) throw new Error("NETWORK_TIMEOUT"); return Response.json(control.form); }
    if (url.endsWith(":batchUpdate")) {
      if (control.failSetup) throw new Error("SETUP_TEST_FAILURE");
      const body = JSON.parse(init.body);
      for (const request of body.requests) if (request.createItem) {
        const item = request.createItem.item;
        assert.match(item.itemId, /^[0-7][0-9a-f]{7}$/);
        assert.match(item.questionItem.question.questionId, /^[0-7][0-9a-f]{7}$/);
        control.form.items.push(item);
      }
      return Response.json({});
    }
    if (url.endsWith(":setPublishSettings")) return Response.json({ formId: control.form.formId, publishSettings: JSON.parse(init.body).publishSettings });
    if (url.includes("forms.googleapis.com/v1/forms/")) return Response.json({ ...control.form, responderUri: control.missingUrl ? undefined : control.form.responderUri });
    throw new Error(`Unexpected external request ${url}`);
  };
  const modules = new Map();
  function load(path) {
    const full = resolve(path);
    if (modules.has(full)) return modules.get(full).exports;
    const module = { exports: {} }; modules.set(full, module);
    const code = ts.transpileModule(readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: { env: { AUTH_SECRET: "test-only-approval-secret", GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test", GOOGLE_FORMS_TEST_SUPABASE_URL: "https://test-db.example.test", GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: "test-only", GOOGLE_FORMS_CLIENT_ID: "test", GOOGLE_FORMS_CLIENT_SECRET: "test", GOOGLE_FORMS_TEST_ORIGIN: "http://localhost:3300", ...envOverrides } }, fetch, Response, Request, Headers, AbortSignal, URL, URLSearchParams, Buffer, crypto: webcrypto, console, Date, Map, Set })(
      (id) => {
        const normalized = id.startsWith(".") ? "@/" + resolve(dirname(full), id).split("/src/")[1] : id;
        if (stubs[normalized]) return stubs[normalized];
        if (normalized.startsWith("@/")) return load(`src/${normalized.slice(2)}.ts`);
        return require(id);
      }, module, module.exports);
    return module.exports;
  }
  return { tables, control, load };
}

test("response routes reject anonymous, ordinary members and other-club admins", async () => {
  for (const scenario of [
    { authenticated: false, manageableClubs: ["ecc"], status: 401 },
    { authenticated: true, manageableClubs: [], status: 403 },
    { authenticated: true, manageableClubs: ["jeju"], status: 403 }
  ]) {
    const h = harness();
    Object.assign(h.control, scenario);
    h.tables.google_forms.push({ id: "test-form", club_key: "ecc" });
    const route = h.load("src/app/api/google-forms/forms/[id]/responses/route.ts");
    for (const method of ["GET", "POST"]) {
      const response = await route[method](new Request("http://localhost/test"), { params: Promise.resolve({ id: "test-form" }) });
      assert.equal(response.status, scenario.status);
      assert.equal(h.tables.google_form_responses.length, 0);
    }
  }
});

test("read-only managers can view responses but cannot trigger sync", async () => {
  const h = harness();
  h.control.canWrite = false;
  h.tables.google_forms.push({ id: "test-form", club_key: "ecc" });
  h.tables.google_form_responses.push({ id: "response", google_form_registry_id: "test-form", answers_json: { name: ["Test participant"] } });
  const route = h.load("src/app/api/google-forms/forms/[id]/responses/route.ts");
  const context = { params: Promise.resolve({ id: "test-form" }) };
  const viewed = await route.GET(new Request("http://localhost/test"), context);
  assert.equal(viewed.status, 200);
  assert.equal((await viewed.json()).responses.length, 1);
  const synced = await route.POST(new Request("http://localhost/test"), context);
  assert.equal(synced.status, 403);
});
const draft = { clubKey: "ecc", templateId: "ecc_gathering", title: "ECC Gathering", description: "Practice", activityId: "gathering", activityTitle: "Gathering", activityDate: "2026-10-09T18:00:00+09:00", applicationDeadline: "2026-10-08T18:00:00+09:00", location: "Library", editorEmail: "", questions: [{ id: "name", title: "Name", type: "short_answer", required: true, options: [] }, { id: "days", title: "Available days", type: "checkbox", required: true, options: ["Friday", "Saturday"] }] };

test("real questionId mapping preserves repeated titles, multiple choices, deleted questions and file metadata", () => {
  const { load } = harness(); const { mapResponseAnswers, actualResponderUrl } = load("src/lib/googleForms/responses.ts");
  const result = mapResponseAnswers({ items: [{ itemId: "item1", title: "Name", questionItem: { question: { questionId: "q1" } } }, { itemId: "item2", title: "Name", questionItem: { question: { questionId: "q2" } } }] }, { q1: { textAnswers: { answers: [{ value: "A" }] } }, q2: { textAnswers: { answers: [{ value: "Mon" }, { value: "Wed" }] } }, removed: { fileUploadAnswers: { answers: [{ fileId: "f1" }] } } });
  assert.equal(result.q1.itemId, "item1"); assert.deepEqual(json(result.q2.values), ["Mon", "Wed"]); assert.equal(result.removed.removed, true); assert.equal(result.removed.files[0].fileId, "f1");
  assert.throws(() => actualResponderUrl(undefined)); assert.throws(() => actualResponderUrl("https://evil.example/viewform"));
});

test("private creation retries keep the remote form and never create a duplicate; mismatched keys rejected", async () => {
  const h = harness(); const api = h.load("src/lib/googleForms/googleApi.ts"); h.control.failSetup = true;
  await assert.rejects(api.createGoogleForm(draft, "admin@example.test", "idempotent-request-1"), /RETRYABLE/);
  assert.equal(h.tables.google_form_creation_attempts[0].remote_form_id, "remote123"); h.control.failSetup = false;
  const form = await api.createGoogleForm(draft, "admin@example.test", "idempotent-request-1");
  assert.equal(form.status, "draft"); assert.equal(h.control.externalCreates, 1);
  await api.createGoogleForm(draft, "admin@example.test", "idempotent-request-1"); assert.equal(h.control.externalCreates, 1);
  await assert.rejects(api.createGoogleForm({ ...draft, title: "Changed" }, "admin@example.test", "idempotent-request-1"), /MISMATCH/);
});

test("ambiguous create failure stops retries instead of generating duplicate forms", async () => {
  const h = harness(); const api = h.load("src/lib/googleForms/googleApi.ts"); h.control.uncertain = true;
  await assert.rejects(api.createGoogleForm(draft, "admin@example.test", "idempotent-uncertain"), /UNCERTAIN/);
  await assert.rejects(api.createGoogleForm(draft, "admin@example.test", "idempotent-uncertain"), /UNCERTAIN/);
  assert.equal(h.control.externalCreates, 1);
});

test("question ID collisions fail before creating a remote form", async () => {
  const h = harness(); const api = h.load("src/lib/googleForms/googleApi.ts");
  await assert.rejects(api.createGoogleForm({ ...draft, questions: [draft.questions[0], draft.questions[0]] }, "admin@example.test", "idempotent-collision"), /QUESTION_ID_COLLISION/);
  assert.equal(h.control.externalCreates, 0);
});

test("missing real responder URL never produces a registry or fabricated URL", async () => {
  const h = harness(); h.control.missingUrl = true;
  await assert.rejects(h.load("src/lib/googleForms/googleApi.ts").createGoogleForm(draft, "admin@example.test", "idempotent-no-url"));
  assert.equal(h.tables.google_forms.length, 0);
});

test("paginated response sync is idempotent, isolated and updates counts only after complete success", async () => {
  const h = harness(); const api = h.load("src/lib/googleForms/googleApi.ts"); const form = await api.createGoogleForm(draft, "admin@example.test", "idempotent-sync-test");
  const questionId = h.control.form.items[0].questionItem.question.questionId;
  const response = { responseId: "response1", createTime: "2026-10-05T10:00:00Z", answers: { [questionId]: { textAnswers: { answers: [{ value: "Person" }] } } } };
  h.control.pages = [{ responses: [response], nextPageToken: "page2" }, { responses: [response] }];
  assert.equal(await api.syncGoogleFormResponses(form), 1);
  h.control.pages = [{ responses: [response] }]; await api.syncGoogleFormResponses(form);
  assert.equal(h.tables.google_form_responses.length, 1); assert.equal(h.tables.google_form_responses[0].google_form_registry_id, form.id);
  assert.equal(Object.values(h.tables.google_form_responses[0].raw_answers_json)[0].title, "Name");
  h.control.pages = [{ nextPageToken: "same" }, { nextPageToken: "same" }]; await assert.rejects(api.syncGoogleFormResponses(form), /REPEATED/);
  assert.equal(h.tables.google_forms[0].response_count, 1);
  h.control.pages = [{ responses: [] }]; assert.equal(await api.syncGoogleFormResponses(form), 0);
  assert.equal(h.tables.google_form_responses.length, 1); // Historical mirror is preserved, not deleted.
});

test("invalid email answers remain in raw data but are not treated as account identifiers", async () => {
  const h = harness(); const api = h.load("src/lib/googleForms/googleApi.ts");
  const emailDraft = { ...draft, questions: [{ id: "email", title: "Email / 이메일", type: "short_answer", required: true, options: [] }] };
  const form = await api.createGoogleForm(emailDraft, "admin@example.test", "invalid-email-response-test");
  const questionId = h.control.form.items[0].questionItem.question.questionId;
  h.control.pages = [{ responses: [{ responseId: "invalid-email", createTime: "2026-10-06T00:00:00Z", answers: { [questionId]: { textAnswers: { answers: [{ value: "Not an email" }] } } } }] }];
  await api.syncGoogleFormResponses(form);
  const row = h.tables.google_form_responses[0];
  assert.equal(row.respondent_email, null);
  assert.equal(row.matched_user_email, null);
  assert.equal(Object.values(row.answers_json)[0][0], "Not an email");
});

test("Korean/English requests produce drafts or explicit clarification without guessing dates", () => {
  const { load } = harness(); const planning = load("src/lib/googleForms/planning.ts");
  assert.equal(planning.planActivity("구글폼 ECC International Gathering 장소는 중앙도서관이고, 2026-10-09T18:00+09:00 2026-10-08T18:00+09:00 국적 성별").missing.length, 0);
  assert.equal(planning.planActivity("Google Form International Gathering at the library, 2026-10-09T18:00+09:00 2026-10-08T18:00+09:00 nationality gender").missing.length, 0);
  assert.ok(planning.planActivity("금요일 구글폼 만들어줘").missing.length > 0);
  const gathering = planning.planActivity("International Gathering 폼 만들기");
  assert.equal(gathering.missing.length, 0);
  assert.equal(gathering.draft.title, "ECC International Gathering");
  assert.equal(gathering.draft.activityDate, "");
  assert.equal(gathering.draft.location, "");
  assert.match(gathering.draft.description, /group decides its activity and meeting place together/);
  assert.doesNotMatch(gathering.draft.description, /reviewed|not specified in this template/i);
  assert.equal(gathering.draft.questions.some(question => /email|이메일/i.test(question.title)), false);
  assert.equal(gathering.draft.questions.length, 5);
  assert.ok(gathering.draft.questions.some(question => /Preferred food/.test(question.title)));
  assert.equal(planning.noticeWithFormUrl("no placeholder", "https://docs.google.com/forms/d/e/actual/viewform"), "no placeholder");
});

test("short Gathering form command reaches the approval workflow", async () => {
  const h = harness(); const { handleGoogleFormsOperation: run } = h.load("src/lib/googleForms/gateway.ts");
  const response = await run({ message: "International Gathering 폼 만들기" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.token);
  assert.equal(result.workflow.draft.templateId, "ecc_gathering");
  assert.equal(h.control.externalCreates, 0);
  assert.deepEqual(result.workflow.draft.questions.at(-1).options, ["Wednesday / 수요일"]);
});

test("activity notices follow bilingual rule sections and keep application URLs separate", () => {
  const { load } = harness(); const planning = load("src/lib/googleForms/planning.ts");
  const { draftFromTemplate } = load("src/lib/googleForms/templates.ts");
  const english = planning.generateActivityNotice(draftFromTemplate("ecc", "ecc_english_class", "ECC English Class"));
  assert.match(english, /English Conversation Class 공지/);
  assert.match(english, /목요일 저녁 6시 이후/);
  assert.match(english, /Thursday, after 6pm/);
  assert.match(english, /전날까지/);
  assert.match(english, /신청이 제한됩니다/);
  assert.doesNotMatch(english, /GOOGLE_FORM_URL|https?:/);
  const gathering = planning.generateActivityNotice(draftFromTemplate("ecc", "ecc_gathering", "International Gathering"));
  assert.match(gathering, /조별 채팅방/);
  assert.doesNotMatch(gathering, /Thursday|목요일/);
  const general = planning.generateActivityNotice(draftFromTemplate("general", "general_activity", "New activity"));
  assert.doesNotMatch(general, /Thursday|목요일|제한됩니다|restricted/);
  const dated = planning.generateActivityNotice({ ...draftFromTemplate("ecc", "ecc_english_class", "Special Class"), activityDate: "2026-10-09T19:00+09:00", applicationDeadline: "2026-10-08T18:00+09:00" });
  assert.match(dated, /2026년 10월 9일/);
  assert.match(dated, /October 9, 2026/);
  assert.doesNotMatch(dated, /목요일 저녁 6시 이후|Thursday, after 6pm/);
  const legacy = "공지 본문\n\n신청 링크 / Application Form URL: {{GOOGLE_FORM_URL}}";
  assert.equal(planning.noticeWithFormUrl(legacy, "https://docs.google.com/forms/d/e/actual/viewform"), "공지 본문");
  assert.equal(planning.noticeBody("공지 본문\n신청 링크: https://docs.google.com/forms/d/e/actual/viewform"), "공지 본문");
});

test("new activity uses structured AI questions and preserves only supplied logistics", async () => {
  const h = harness(); const { planNewActivity } = h.load("src/lib/googleForms/aiPlanning.ts");
  const message = "제주 바다 사진 산책 폼 만들어줘. 일시: 2026-10-20T14:00+09:00. 신청 마감: 2026-10-19T18:00+09:00. 장소: 함덕해수욕장.";
  const generated = { title: "제주 바다 사진 산책", descriptionKo: "함께 해변을 걸으며 사진을 찍습니다.", descriptionEn: "Walk along the beach and take photos together.",
    activityDate: "2099-01-01", location: "Invented venue", clubKey: "hanhwal", editorEmail: "attacker@example.test",
    questions: [{ title: "카카오톡 이름", type: "short_answer", required: true, options: [] },
      { title: "촬영 장비", type: "multiple_choice", required: true, options: ["스마트폰", "카메라"] },
      { title: "원하는 촬영 주제", type: "paragraph", required: false, options: [] }] };
  let calls = 0;
  const generate = async input => { calls++; assert.deepEqual(json(input.history), []); assert.equal(input.message, message); return { answer: JSON.stringify(generated), provider: "test" }; };
  const result = await planNewActivity(message, { enabled: true, generate });
  assert.equal(calls, 1); assert.equal(result.draft.templateId, "blank");
  assert.equal(result.draft.title, generated.title); assert.equal(result.draft.questions[1].type, "multiple_choice");
  assert.equal(result.draft.activityDate, "2026-10-20T14:00+09:00");
  assert.equal(result.draft.location, "함덕해수욕장"); assert.equal(result.draft.clubKey, "ecc");
  assert.equal(result.draft.editorEmail, "");
  assert.equal(result.draft.descriptionKo, generated.descriptionKo);
  assert.equal(result.draft.descriptionEn, generated.descriptionEn);
  assert.match(result.draft.questions.at(-1).title, /요청사항/);
  assert.equal(result.draft.questions.at(-1).required, false);
  const noDetails = await planNewActivity("사진 산책 폼 만들어줘", { enabled: true, generate: async () => ({ answer: JSON.stringify(generated), provider: "test" }) });
  assert.equal(noDetails.draft.activityDate, ""); assert.equal(noDetails.draft.location, "");
  await assert.rejects(planNewActivity(message, { enabled: false, generate }), /활성화/);
  await assert.rejects(planNewActivity(message, { enabled: true, generate: async () => ({ answer: "not json", provider: "test" }) }), /형식/);
  generated.questions[0].title = "Email / 이메일";
  await assert.rejects(planNewActivity(message, { enabled: true, generate }), /DATA_MINIMIZATION/);
});

test("notice knowledge remains activity-specific and bilingual without invented logistics", () => {
  const { load } = harness(); const { generateActivityNotice, noticeBody } = load("src/lib/googleForms/planning.ts");
  const { draftFromTemplate } = load("src/lib/googleForms/templates.ts");
  const mt = generateActivityNotice(draftFromTemplate("ecc", "ecc_mt", "ECC MT"));
  assert.match(mt, /ECC MT 참여 신청/); assert.match(mt, /participate in the ECC MT/);
  assert.doesNotMatch(mt, /제한됩니다|restricted|15,000|Wednesday|목요일|✅ 장소|✅ 활동 시간/);
  const novel = generateActivityNotice({ ...draftFromTemplate("ecc", "ecc_general", "차와 엽서"), templateId: "blank", descriptionKo: "차를 맛보고 엽서를 만듭니다.", descriptionEn: "Taste tea and create postcards.", description: "" });
  assert.match(novel, /차를 맛보고 엽서를/); assert.match(novel, /Taste tea and create postcards/);
  assert.doesNotMatch(novel, /restricted|매주|Thursday|KST/);
  assert.equal(noticeBody("활동 안내\nECC OFFICIAL CHAT: process notice reviewed 2026-09-14.\nEnglish guidance"), "활동 안내\nEnglish guidance");
});

test("new activity rejects incomplete bilingual notices and removes post-event questions", async () => {
  const { load } = harness(); const { planNewActivity } = load("src/lib/googleForms/aiPlanning.ts");
  const input = { title: "소리 산책", descriptionKo: "소리를 관찰합니다. 사전 준비 없이 참여할 수 있습니다. 서울의 소리를 발견하세요.", descriptionEn: "Observe sounds together. No prior preparation is needed. Discover sounds of Seoul together.", questions: [{ title: "활동 후 소감 (100자 이내)", type: "paragraph", required: true, options: [] }] };
  const generate = async () => ({ answer: JSON.stringify(input), provider: "test" });
  const { draft: result } = await planNewActivity("소리 산책", { enabled: true, generate });
  assert.equal(result.questions.length, 2);
  assert.match(result.questions[0].title, /KakaoTalk name/);
  assert.match(result.questions[1].title, /Other requests/);
  assert.equal(result.questions[1].required, false);
  assert.equal(result.descriptionKo, "소리를 관찰합니다.");
  assert.equal(result.descriptionEn, "Observe sounds together.");
  input.descriptionEn = "";
  await assert.rejects(planNewActivity("소리 산책", { enabled: true, generate }), /한국어와 영어/);
});

const entryFormId = "11111111-1111-4111-8111-111111111111";
const entryForm = { id: entryFormId, club_key: "ecc", status: "open", title: "ECC Gathering", google_form_id: "remote123", responder_url: "https://docs.google.com/forms/d/e/real-response/viewform", application_deadline: null };
function entryHarness(overrides = {}) {
  const h = harness({ GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED: "true", GOOGLE_FORMS_NATIVE_EXPIRY_VERIFIED: "true", ...overrides });
  h.tables.google_forms.push({ ...entryForm });
  h.control.form.publishSettings = { publishState: { isPublished: true, isAcceptingResponses: true } };
  return h;
}
const entryContext = () => ({ params: Promise.resolve({ id: entryFormId }) });
const entryRequest = (body, origin = "http://localhost") => new Request("http://localhost/api/google-forms/forms/" + entryFormId + "/entry", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

test("ECC form access requires both payment and approval; only transient lookup failures allow declaration", async () => {
  const h = entryHarness(); const entry = h.load("src/lib/googleForms/eccResponderEntry.ts");
  assert.equal(await entry.lookupEccFormEligibility("member@example.test"), "unpaid");
  h.control.memberRole = { payment_confirmed: true };
  assert.equal(await entry.lookupEccFormEligibility("member@example.test"), "unpaid");
  h.control.memberRole.official_member_status = "approved";
  assert.equal(await entry.lookupEccFormEligibility("member@example.test"), "eligible");
  h.control.memberLookupError = new Error("transient");
  assert.equal(await entry.lookupEccFormEligibility("member@example.test"), "outage");
  h.control.memberLookupError = new Error("configuration or forbidden");
  assert.equal(await entry.lookupEccFormEligibility("member@example.test"), "unavailable");
  assert.equal(h.control.permissionCalls, undefined);
});

test("temporary ECC form token is bound to account and form, tamper proof and expires at 15 minutes", () => {
  const entry = entryHarness().load("src/lib/googleForms/eccResponderEntry.ts");
  const now = Date.now(); const expires = now + 900000;
  const token = entry.issueEccFormEntry("member@example.test", entryFormId, expires, "secret");
  assert.equal(entry.readEccFormEntry(token, "member@example.test", entryFormId, "secret", now), expires);
  assert.equal(entry.readEccFormEntry(token, "other@example.test", entryFormId, "secret", now), null);
  assert.equal(entry.readEccFormEntry(token, "member@example.test", "other-form", "secret", now), null);
  assert.equal(entry.readEccFormEntry(token + "x", "member@example.test", entryFormId, "secret", now), null);
  assert.equal(entry.readEccFormEntry(token, "member@example.test", entryFormId, "secret", expires), null);
  assert.equal(entry.readEccFormEntry(token, "member@example.test", entryFormId, "wrong", now), null);
});

test("ECC form routes reject anonymous users, unpaid declarations, cross-origin and non-transient errors", async () => {
  for (const scenario of [
    { memberLoggedOut: true, status: 401 },
    { memberRole: { payment_confirmed: false, is_official_member: true }, status: 403 },
    { memberRole: { payment_confirmed: true, is_official_member: false }, status: 403 },
    { memberLookupError: new Error("configuration"), status: 503 },
  ]) {
    const h = entryHarness(); Object.assign(h.control, scenario);
    const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
    const response = await route.POST(entryRequest({ paid: true, email: "paid-other@example.test" }), entryContext());
    assert.equal(response.status, scenario.status);
    assert.equal(h.control.permissionCalls, undefined);
    assert.equal(h.tables.google_form_responses.length, 0);
  }
  const h = entryHarness(); const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
  assert.equal((await route.POST(entryRequest({ paid: true }, "https://evil.example"), entryContext())).status, 403);
});

test("outage GET is read only and unpaid answer does not issue Google access", async () => {
  const h = entryHarness(); h.control.memberLookupError = new Error("transient");
  const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
  const response = await route.GET(new Request("http://localhost/test"), entryContext());
  assert.equal((await response.json()).state, "outage");
  assert.equal((await route.POST(entryRequest({ paid: false }), entryContext())).status, 409);
  assert.equal(h.control.permissionCalls, undefined);
});

test("outage declaration grants respondent-only native expiry and retry cannot extend its original expiry", async () => {
  const h = entryHarness(); h.control.memberLookupError = new Error("transient");
  const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
  const started = Date.now();
  const response = await route.POST(entryRequest({ paid: true, email: "other@example.test", expires: started + 99999999 }), entryContext());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.state, "temporary");
  assert.ok(data.expiresAt <= started + 900000 && data.expiresAt > started + 898000);
  const grant = h.control.permissions[0];
  assert.equal(grant.emailAddress, "member@example.test");
  assert.equal(grant.role, "reader"); assert.equal(grant.view, "published");
  assert.equal(Date.parse(grant.expirationTime), data.expiresAt);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=strict/);
  h.control.entryToken = /ecc-google-form-outage-entry=([^;]+)/.exec(setCookie)[1];
  const retry = await route.POST(entryRequest({}), entryContext());
  assert.equal((await retry.json()).expiresAt, data.expiresAt);
  assert.equal(h.control.permissions.length, 1);
  // Fresh confirmed nonmembership overrides the previously signed temporary token.
  h.control.memberLookupError = null; h.control.memberRole = null;
  assert.equal((await route.POST(entryRequest({ paid: true }), entryContext())).status, 403);
});

test("server revocation persists leases, reuses expiry and revokes only expired tracked grants", async () => {
  const h = entryHarness({ GOOGLE_FORMS_SERVER_REVOCATION_ENABLED: "true", GOOGLE_FORMS_NATIVE_EXPIRY_VERIFIED: "false" });
  h.control.memberLookupError = new Error("transient");
  const worker = h.load("src/lib/googleForms/eccFormLeases.ts");
  await worker.revokeExpiredEccFormEntries();
  const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
  const response = await route.POST(entryRequest({ paid: true }), entryContext());
  assert.equal(response.status, 200);
  const data = await response.json();
  const [lease] = h.tables.ecc_form_entry_leases;
  assert.equal(lease.state, "active");
  assert.equal(lease.permission_id, h.control.permissions[0].id);
  assert.equal(h.control.permissions[0].expirationTime, undefined);
  assert.equal(Date.parse(lease.expires_at), data.expiresAt);
  const retry = await route.POST(entryRequest({ paid: true }), entryContext());
  assert.equal((await retry.json()).expiresAt, data.expiresAt);
  h.control.permissions.push({ id: "editor", type: "user", role: "writer", emailAddress: "other@example.test" });
  assert.equal((await worker.revokeExpiredEccFormEntries(data.expiresAt - 1)).revoked, 0);
  assert.equal((await worker.revokeExpiredEccFormEntries(data.expiresAt)).revoked, 1);
  assert.equal(lease.state, "revoked");
  assert.deepEqual(h.control.permissions.map(item => item.id), ["editor"]);
  assert.equal((await worker.revokeExpiredEccFormEntries(data.expiresAt)).revoked, 0);
});

test("server revoker retries failures, preserves promotions and refuses unhealthy or concurrent grants", async () => {
  for (const scenario of ["unhealthy", "busy", "promote", "retry", "changed"]) {
    const h = entryHarness({ GOOGLE_FORMS_SERVER_REVOCATION_ENABLED: "true" });
    h.control.memberLookupError = new Error("transient");
    const worker = h.load("src/lib/googleForms/eccFormLeases.ts");
    const entry = h.load("src/lib/googleForms/eccResponderEntry.ts");
    if (scenario === "unhealthy") {
      await assert.rejects(entry.grantEccFormResponder(entryForm, "member@example.test", Date.now()+900000), /NOT_HEALTHY/);
      assert.equal(h.control.permissionCalls, undefined); continue;
    }
    await worker.revokeExpiredEccFormEntries();
    if (scenario === "busy") {
      (h.control.formLocks ||= new Set()).add(entryForm.google_form_id);
      await assert.rejects(entry.grantEccFormResponder(entryForm, "member@example.test", Date.now()+900000), /BUSY/); continue;
    }
    const expires = Date.now()+900000;
    await entry.grantEccFormResponder(entryForm, "member@example.test", expires);
    if (scenario === "promote") { h.control.memberLookupError = null; h.control.memberRole = { payment_confirmed: true, is_official_member: true }; }
    if (scenario === "retry") h.control.permissionApiError = true;
    if (scenario === "changed") h.control.permissions[0].role = "writer";
    const result = await worker.revokeExpiredEccFormEntries(expires);
    if (scenario === "promote") { assert.equal(result.promoted, 1); assert.equal(h.tables.ecc_form_entry_leases[0].state, "promoted"); }
    if (scenario === "changed") { assert.equal(result.attention, 1); assert.equal(h.tables.ecc_form_entry_leases[0].state, "attention"); }
    if (scenario === "retry") { assert.equal(result.retry, 1); h.control.permissionApiError = false; assert.equal((await worker.revokeExpiredEccFormEntries(expires)).revoked, 1); }
    if (scenario !== "retry") assert.equal(h.control.permissions.length, 1);
  }
});

test("revoker endpoint requires dedicated secret before any DB or permission requests", async () => {
  const h = entryHarness({ GOOGLE_FORMS_REVOKER_SECRET: "r".repeat(32), GOOGLE_FORMS_SERVER_REVOCATION_ENABLED: "true" });
  const route = h.load("src/app/api/google-forms/ecc-entry/revoke/route.ts");
  assert.equal((await route.POST(new Request("http://localhost/worker", {method:"POST"}))).status, 401);
  assert.equal(h.tables.ecc_form_revoker_health.length, 0);
  assert.equal((await route.POST(new Request("http://localhost/worker", {method:"POST",headers:{authorization:`Bearer ${"r".repeat(32)}`}}))).status, 200);
});

test("server revocation SQL is additive, repeatable and private; locks serialize each form", async () => {
  const db = new PGlite();
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
  const sql = readFileSync("supabase/google_forms_ecc_server_revocation_test.sql", "utf8");
  await db.exec(sql); await db.exec(sql);
  const first = await db.query("SELECT public.kline_forms_test_ecc_form_lock('form') AS token");
  assert.ok(first.rows[0].token);
  assert.equal((await db.query("SELECT public.kline_forms_test_ecc_form_lock('form') AS token")).rows[0].token, null);
  await db.query("SELECT public.kline_forms_test_ecc_form_unlock('form',$1)", [first.rows[0].token]);
  assert.ok((await db.query("SELECT public.kline_forms_test_ecc_form_lock('form') AS token")).rows[0].token);
  await db.exec("SET ROLE anon");
  await assert.rejects(db.query("SELECT * FROM public.kline_forms_test_ecc_form_entry_leases"));
  await db.close();
});

test("native expiry is mandatory: unverified, unsupported and silently ignored expiry never grant entry", async () => {
  for (const scenario of [{ verified: "false" }, { unsupportedExpiry: true }, { ignoredExpiry: true }]) {
    const h = entryHarness({ GOOGLE_FORMS_NATIVE_EXPIRY_VERIFIED: scenario.verified || "true" });
    Object.assign(h.control, scenario, { memberLookupError: new Error("transient") });
    const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
    const response = await route.POST(entryRequest({ paid: true }), entryContext());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal((h.control.permissions || []).length, 0);
    if (scenario.ignoredExpiry) assert.equal(h.control.revokedPermissions, 1);
  }
});

test("public form access, closed forms, expired deadlines and other clubs cannot be bypassed", async () => {
  for (const scenario of [
    { permissions: [{ id: "public", type: "anyone", role: "reader", view: "published" }] },
    { status: "closed" }, { application_deadline: "2020-01-01T00:00:00Z" }, { club_key: "jeju" },
    { remoteClosed: true },
  ]) {
    const h = entryHarness(); h.control.memberLookupError = new Error("transient");
    Object.assign(h.tables.google_forms[0], scenario);
    if (scenario.permissions) h.control.permissions = scenario.permissions;
    if (scenario.remoteClosed) h.control.form.publishSettings.publishState.isAcceptingResponses = false;
    const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
    const response = await route.POST(entryRequest({ paid: true }), entryContext());
    assert.ok([404, 503].includes(response.status));
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("confirmed paid members get only responder access and ECC notice links use the guarded entry", async () => {
  const h = entryHarness({ GOOGLE_FORMS_ECC_ENTRY_ORIGIN: "http://localhost:3300" });
  h.control.memberRole = { payment_confirmed: true, is_official_member: true };
  const route = h.load("src/app/api/google-forms/forms/[id]/entry/route.ts");
  const response = await route.POST(entryRequest({}), entryContext());
  assert.equal(response.status, 200); assert.equal((await response.json()).state, "allowed");
  assert.equal(h.control.permissions[0].expirationTime, undefined);
  const entry = h.load("src/lib/googleForms/eccResponderEntry.ts");
  assert.equal(entry.eccFormApplicationUrl(entryForm), `http://localhost:3300/google-forms/ecc/${entryFormId}`);
  assert.equal(entry.eccFormApplicationUrl({ ...entryForm, club_key: "jeju" }), entryForm.responder_url);
  const disabled = entryHarness({ GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED: "false" });
  assert.equal(disabled.load("src/lib/googleForms/eccResponderEntry.ts").eccFormApplicationUrl(entryForm), entryForm.responder_url);
});

test("unknown activity fails closed without AI configuration and performs no external creation", async () => {
  const h = harness(); const run = h.load("src/lib/googleForms/gateway.ts").handleGoogleFormsOperation;
  const response = await run({ message: "새 사진 산책 폼 만들어줘" });
  assert.equal(response.status, 400);
  assert.equal(h.control.externalCreates, 0); assert.equal(h.tables.google_form_workflows.length, 0);
});

test("new activity AI gateway preserves approval and checks permission before inference", async () => {
  const h = harness({ GOOGLE_FORMS_AI_PLANNING_ENABLED: "true", NVIDIA_API_KEY: "test-only-ai-key" });
  h.control.aiDraft = { title: "사진 산책", descriptionKo: "해변을 걸으며 사진을 찍습니다.", descriptionEn: "Walk along the beach and take photos.", questions: [
    { title: "카카오톡 이름", type: "short_answer", required: true, options: [] },
    { title: "촬영 장비", type: "multiple_choice", required: true, options: ["스마트폰", "카메라"] }] };
  const run = h.load("src/lib/googleForms/gateway.ts").handleGoogleFormsOperation;
  h.control.canWrite = false;
  assert.equal((await run({ message: "사진 산책 폼 만들어줘" })).status, 403);
  assert.equal(h.control.aiCalls || 0, 0);
  h.control.canWrite = true;
  const preview = await (await run({ message: "사진 산책 폼 만들어줘" })).json();
  assert.equal(h.control.aiCalls, 1); assert.ok(preview.token);
  assert.equal(preview.workflow.draft.title, "사진 산책");
  assert.equal(h.control.externalCreates, 0);
  assert.equal(h.tables.club_board_posts.length, 0);
  const completed = await run({ action: "confirm_google_forms", token: preview.token });
  assert.equal(completed.status, 200); assert.equal(h.control.externalCreates, 1);
  assert.equal(h.tables.club_board_posts[0].status, "draft");
});

test("existing Woohyukmon API works without local keys and fails closed when unavailable", async () => {
  const h = harness({ GOOGLE_FORMS_AI_PLANNING_ENABLED: "true", GOOGLE_FORMS_AI_EXISTING_API_ENABLED: "true" });
  h.control.aiDraft = { title: "바다 사진 산책", descriptionKo: "함께 사진을 찍습니다.", descriptionEn: "Take photos together.", questions: [
    { title: "카카오톡 이름", type: "short_answer", required: true, options: [] },
    { title: "사용할 촬영 장비", type: "multiple_choice", required: true, options: ["카메라", "스마트폰"] }] };
  const run = h.load("src/lib/googleForms/gateway.ts").handleGoogleFormsOperation;
  const response = await run({ message: "바다 사진 산책 폼 만들어줘" });
  assert.equal(response.status, 200); assert.equal(h.control.existingAiCalls, 1);
  assert.equal(h.control.externalCreates, 0);
  h.control.failExistingAi = true;
  assert.equal((await run({ message: "바다 사진 산책 폼 만들어줘" })).status, 400);
  assert.equal(h.tables.google_form_workflows.length, 1);
});

test("Gathering weekdays use verified live switches and fail closed on missing options", async () => {
  const h = harness(); const { withCurrentGatheringDays } = h.load("src/lib/googleForms/gathering.ts");
  const preset = h.load("src/lib/googleForms/templates.ts").draftFromTemplate("ecc", "ecc_gathering", "Gathering");
  h.control.gatheringDays = ["monday", "wednesday"];
  const both = await withCurrentGatheringDays(preset);
  assert.deepEqual(json(both.questions.at(-1).options), ["Monday / 월요일", "Wednesday / 수요일"]);
  assert.equal(both.questions.at(-1).type, "checkbox");
  assert.equal((await withCurrentGatheringDays(both)).questions.length, both.questions.length);
  h.control.gatheringDays = [];
  await assert.rejects(withCurrentGatheringDays(preset), /NO_VERIFIED_GATHERING_WEEKDAYS/);
  h.control.gatheringDays = ["friday"];
  await assert.rejects(withCurrentGatheringDays(preset), /NO_VERIFIED_GATHERING_WEEKDAYS/);
});

test("title-only presets retain existing questions without inventing event metadata", () => {
  const templates = harness().load("src/lib/googleForms/templates.ts");
  const preset = templates.draftFromTemplate("ecc", "ecc_gathering", "Friday Gathering");
  assert.equal(preset.title, "Friday Gathering");
  assert.ok(preset.questions.length > 0);
  assert.equal(preset.activityDate, "");
  assert.equal(preset.applicationDeadline, "");
  assert.equal(preset.location, "");
  assert.throws(() => templates.draftFromTemplate("ecc", "unknown", "Title"));
});

test("gateway requires approval, binds actor and revision, preserves form on notice failure and recovers without duplicates", async () => {
  const h = harness(); const { handleGoogleFormsOperation: run } = h.load("src/lib/googleForms/gateway.ts");
  const initial = await (await run({ action: "DRAFT_GOOGLE_FORM", draft })).json();
  assert.equal(h.control.externalCreates, 0);
  h.control.failNotice = true;
  assert.equal((await run({ action: "confirm_google_forms", token: initial.token })).status, 400);
  assert.equal(h.control.externalCreates, 1); assert.ok(h.tables.google_form_workflows[0].form_registry_id);
  h.control.failNotice = false;
  const retry = await (await run({ action: "PREVIEW_GOOGLE_FORM", workflowId: initial.workflow.id })).json();
  const confirmed = await run({ action: "confirm_google_forms", token: retry.token });
  assert.equal(confirmed.status, 200);
  const result = await confirmed.json();
  assert.equal(result.applicationUrl, result.form.responder_url);
  assert.equal(result.notice.includes(result.form.responder_url), false);
  assert.equal(result.notice.includes("{{GOOGLE_FORM_URL}}"), false);
  assert.equal(h.control.externalCreates, 1); assert.equal(h.tables.club_board_posts.length, 1); assert.equal(h.tables.club_board_posts[0].status, "draft");
  assert.doesNotMatch(h.tables.club_board_posts[0].content, /real-response|GOOGLE_FORM_URL/);
  assert.equal((await run({ action: "PUBLISH_ACTIVITY_NOTICE", workflowId: initial.workflow.id })).status, 400);
});

test("read-only and unauthenticated actors cannot mutate workflow; stale previews cannot execute", async () => {
  const h = harness(); const run = h.load("src/lib/googleForms/gateway.ts").handleGoogleFormsOperation;
  const initial = await (await run({ action: "DRAFT_GOOGLE_FORM", draft })).json();
  await run({ action: "UPDATE_ACTIVITY_NOTICE", workflowId: initial.workflow.id, notice: "Edited {{GOOGLE_FORM_URL}}" });
  assert.equal((await run({ action: "confirm_google_forms", token: initial.token })).status, 400);
  h.control.canWrite = false; assert.equal((await run({ action: "DRAFT_GOOGLE_FORM", draft })).status, 403);
  h.control.authenticated = false; assert.equal((await run({ action: "DRAFT_GOOGLE_FORM", draft })).status, 401);
  assert.equal(h.control.externalCreates, 0);
});

test("SQL executes twice in isolated Postgres; RLS denies public access; activity instances coexist", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    const base = readFileSync("supabase/google_forms_application_migration.sql", "utf8").replace("create extension if not exists pgcrypto;", "");
    const workflow = readFileSync("supabase/google_forms_workflows.sql", "utf8");
    await db.exec(base + workflow); await db.exec(base + workflow);
    await db.exec("insert into google_forms (club_key,activity_id,activity_instance_id,google_form_id,title,responder_url,idempotency_key,created_by) values ('ecc','gathering','fall','f1','Gathering','real','k1','admin'),('ecc','gathering','spring','f2','Gathering','real','k2','admin');");
    assert.equal((await db.query("select count(*)::int as count from google_forms")).rows[0].count, 2);
    await db.exec("set role anon"); await assert.rejects(db.query("select * from google_form_workflows"), /permission denied/); await db.exec("reset role");
    const rls = await db.query("select relname from pg_class where relname like 'google_%' and relkind='r' and relrowsecurity=true");
    assert.equal(rls.rows.length, 6);
  } finally { await db.close(); }
});

test("team adapter keeps the Google roster separate and produces balanced, nonduplicated teams", () => {
  const { load } = harness(); const { groupGoogleApplicants } = load("src/lib/googleForms/applicants.ts");
  const rows = Array.from({ length: 13 }, (_, index) => ({ id: String(index), respondent_email: null, answers_json: { Name: [`Person ${index}`] } }));
  const teams = groupGoogleApplicants(rows, 4);
  assert.equal(teams.length, 4); assert.equal(new Set(teams.flat()).size, 13);
  assert.ok(Math.max(...teams.map((group) => group.length)) - Math.min(...teams.map((group) => group.length)) <= 1);
  assert.throws(() => groupGoogleApplicants(rows, -1));
});

test("applicant roster displays names only and never falls back to email or response IDs", () => {
  const { load } = harness(); const { applicantNames, groupGoogleApplicants } = load("src/lib/googleForms/applicants.ts");
  const rows = [
    { id: "private-id-1", respondent_email: "private@example.com", answers_json: { "Name / 이름 [q1]": ["  상경  "], Requests: ["Private request"] } },
    { id: "private-id-2", respondent_email: "other@example.com", answers_json: { Name: ["  "] } },
    { id: "private-id-3", respondent_email: null, answers_json: {} },
  ];
  assert.deepEqual(applicantNames(rows), ["상경", "이름 미입력", "이름 미입력"]);
  assert.equal(groupGoogleApplicants(rows, 4).flat().length, 3);
  assert.ok(!JSON.stringify(groupGoogleApplicants(rows, 4)).includes("@"));
});

test("team notice uses actual names and activity title without inventing event logistics", () => {
  const { load } = harness(); const { googleTeamNotice } = load("src/lib/googleForms/applicants.ts");
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: String(index), respondent_email: `private${index}@example.com`, answers_json: { Name: [`Person ${index}`], Requests: ["Private request"] } }));
  const notice = googleTeamNotice("Gathering", rows, 4);
  assert.ok(notice.startsWith("Gathering — 조 편성 안내 / Team Assignments"));
  for (const row of rows) assert.equal(notice.split(row.answers_json.Name[0]).length - 1, 1);
  assert.ok(notice.includes("2조 / Team 2"));
  assert.ok(!notice.includes("@") && !notice.includes("Private request"));
  assert.equal(googleTeamNotice("Gathering", [], 4), "");
  assert.throws(() => googleTeamNotice("Gathering", rows, 0), /INVALID_TEAM_SIZE/);
});

test("private creation screens do not expose an unpublished respondent URL as an opening link", () => {
  for (const file of ["GoogleFormsManager.tsx", "WoohyukmonFormsAssistant.tsx"]) {
    const source = ts.createSourceFile(file, readFileSync(resolve(`src/components/google-forms/${file}`), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "href") {
        assert.ok(!node.initializer?.getText(source).includes("responder_url"), `${file} must open the private editor, not an unpublished respondent link`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test("all question types and duplicate IDs are validated; templates do not force Monday/Wednesday", () => {
  const { load } = harness(); const validate = load("src/lib/googleForms/validation.ts").parseGoogleFormDraft;
  for (const type of ["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown", "date", "time"]) {
    assert.equal(validate({ ...draft, questions: [{ id: "q", title: "Test", type, required: true, options: ["Yes", "No"] }] }).questions[0].type, type);
  }
  assert.throws(() => validate({ ...draft, questions: [draft.questions[0], draft.questions[0]] }), /DUPLICATE/);
  assert.throws(() => validate({ ...draft, questions: [{ id: "q", title: "Test", type: "checkbox", options: [] }] }), /OPTIONS/);
  const templates = load("src/lib/googleForms/templates.ts").googleFormTemplates;
  for (const id of ["ecc_english_class", "ecc_special_event", "ecc_farewell", "ecc_staff_recruitment"]) assert.ok(templates.some((template) => template.id === id));
  assert.equal(templates.find((template) => template.id === "ecc_gathering").questions.some((question) => question.options.includes("Monday / 월요일")), false);
});

test("feature and isolated database fail closed when test configuration is absent", async () => {
  const h = harness({ GOOGLE_FORMS_ENVIRONMENT: undefined, GOOGLE_FORMS_TEST_SUPABASE_URL: undefined, GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: undefined });
  assert.throws(() => h.load("src/lib/googleForms/safety.ts").assertGoogleFormsTestEnvironment(), /TEST_ENVIRONMENT/);
  await assert.rejects(h.load("src/lib/googleForms/store.ts").supabaseRequest("google_forms"), /ISOLATED/);
  const run = h.load("src/lib/googleForms/gateway.ts").handleGoogleFormsOperation;
  assert.equal(await run({ message: "Google Forms가 무엇인가요?" }), null);
  assert.equal(await run({ message: "이 회원이 납부했나요?" }), null);
});

test("shared project requests can only reach prefixed test tables", async () => {
  const requests = [];
  const env = {
    SUPABASE_URL: "https://okcabiimxuhhhokqajjg.supabase.co",
    GOOGLE_FORMS_TEST_SUPABASE_URL: "https://okcabiimxuhhhokqajjg.supabase.co",
    GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY: "test-key",
    GOOGLE_FORMS_TEST_TABLE_PREFIX: "kline_forms_test_"
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/lib/googleForms/store.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    process: { env }, URL, Headers, AbortSignal,
    fetch: async (url) => { requests.push(url); return Response.json([]); }
  })((id) => id === "server-only" ? {} : { assertGoogleFormsTestEnvironment() {} }, module, module.exports);
  const store = module.exports.supabaseRequest;
  for (const table of ["google_forms", "club_board_posts", "site_members", "google_oauth_connections"]) {
    await store(`${table}?select=*&limit=1`);
    assert.equal(requests.at(-1), `${env.SUPABASE_URL}/rest/v1/kline_forms_test_${table}?select=*&limit=1`);
  }
  for (const path of ["ecc_roles", "rpc/admin_function", "../ecc_roles", "google_forms#fragment", "https://evil.example"]) {
    await assert.rejects(store(path), /NOT_ALLOWED/);
  }
  assert.equal(requests.length, 4);
  env.GOOGLE_FORMS_TEST_TABLE_PREFIX = "";
  await assert.rejects(store("google_forms"), /ISOLATED/);
  env.GOOGLE_FORMS_TEST_TABLE_PREFIX = "other_";
  await assert.rejects(store("google_forms"), /INVALID/);
});

test("shared-project migration preserves native data and denies browser roles", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create table club_board_posts(id text primary key); insert into club_board_posts values('native-unchanged');");
    const sql = readFileSync("supabase/migrations/20261005092720_google_forms_shared_project_test.sql", "utf8").replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query("select * from club_board_posts")).rows, [{ id: "native-unchanged" }]);
    const rows = (await db.query("select relname, relrowsecurity, has_table_privilege('anon', oid, 'SELECT') as anon_read, has_table_privilege('authenticated', oid, 'SELECT') as member_read from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'kline_forms_test_%'")).rows;
    assert.equal(rows.length, 8);
    assert.ok(rows.every((row) => row.relrowsecurity && !row.anon_read && !row.member_read));
  } finally { await db.close(); }
});
