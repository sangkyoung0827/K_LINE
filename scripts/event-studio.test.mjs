import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { eventHarness, fixturePlan, fixtureMessage } from "./event-studio-harness.mjs";

const deletionRequest = (body = { confirmedEnded: true }, origin = "http://127.0.0.1:3346") => new Request("http://127.0.0.1:3346/api/google-forms/forms/test", {
  method: "DELETE", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("follow-up answers regenerate the same draft from saved user facts, with natural questions and no premature Google create", async () => {
  const h = await eventHarness(); try {
    h.control.currentPlan = { ...fixturePlan(), activityDate: null, applicationDeadline: null, location: null, capacity: null,
      noticeKo: fixturePlan().noticeKo + "\n일정과 장소는 미정으로 운영진 확인이 필요합니다.", noticeEn: fixturePlan().noticeEn + "\nThe schedule and venue are pending confirmation." };
    const initial = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: "ECC MT 신청폼과 공지를 만들어 주세요." });
    assert.equal(initial.token, null); assert.equal(h.control.externalCreates, 0);
    assert.match(initial.clarification.ko, /언제 시작|몇 명/); assert.doesNotMatch(initial.clarification.ko, /activityDate|capacity/);
    const calls = h.control.aiCalls;
    await assert.rejects(h.api.studioOperation({ ...h.access(), readOnly: true }, { action: "refine", jobId: initial.job.id, revision: 1, message: fixtureMessage }), /READ_ONLY/);
    await assert.rejects(h.api.studioOperation({ ...h.access(), manageableClubs: ["hanhwal"] }, { action: "refine", jobId: initial.job.id, revision: 1, message: fixtureMessage }), /JOB_NOT_FOUND/);
    assert.equal(h.control.aiCalls, calls);
    h.control.currentPlan = fixturePlan();
    const refined = await h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: 1, message: fixtureMessage });
    assert.equal(refined.job.id, initial.job.id); assert.equal(refined.job.revision, 2);
    assert.deepEqual(refined.missing, []); assert.ok(refined.token);
    assert.match(h.control.requests.at(-1).input, /ECC MT/); assert.match(h.control.requests.at(-1).input, /QA Library/);
    assert.equal((await h.store.db.query("select count(*)::int as n from kline_forms_test_event_studio_jobs")).rows[0].n, 1);
    assert.equal(h.control.externalCreates, 0);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: 1, message: fixtureMessage }), /JOB_CHANGED/);
    const approved = await h.api.studioOperation(h.access(), { action: "approve", jobId: refined.job.id, token: refined.token, confirmed: true });
    assert.equal(approved.job.state, "notice_saved"); assert.equal(h.control.externalCreates, 1);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: 2, message: fixtureMessage }), /CREATED_JOB/);
  } finally { await h.close(); }
});

test("internal draft commentary triggers a complete AI retry, never output editing; invalid refinement preserves its draft", async () => {
  const h = await eventHarness(); try {
    const bad = { ...fixturePlan(), noticeEn: fixturePlan().noticeEn + "\nThis draft does not create a Google Form." };
    h.control.outputs = [JSON.stringify(bad), JSON.stringify(fixturePlan())];
    const generated = await h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage);
    assert.equal(h.control.aiCalls, 2); assert.equal(generated.metadata.retries, 1);
    assert.match(h.control.requests[1].instructions, /EVENT_NOTICE_INTERNAL_COMMENTARY/);
    assert.deepEqual(generated.plan, fixturePlan());
    const initial = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.currentPlan = bad;
    await assert.rejects(h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: 1, message: "같은 조건입니다." }), /EVENT_NOTICE_INTERNAL_COMMENTARY/);
    const unchanged = await h.api.studioOperation(h.access(), { action: "get", jobId: initial.job.id });
    assert.equal(unchanged.job.revision, 1); assert.deepEqual(unchanged.job.plan, initial.job.plan);
    assert.equal(h.control.externalCreates, 0);
    await h.store.db.query("update kline_forms_test_event_studio_jobs set ai_metadata='{}' where id=$1", [initial.job.id]);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "refine", jobId: initial.job.id, revision: 1, message: fixtureMessage }), /EVENT_RESTART_REQUIRED/);
  } finally { await h.close(); }
});

test("new studio jobs include bilingual logistics and capacity in the verified Google original; legacy drafts retain identical content", async () => {
  const h = await eventHarness(); try {
    const plan = fixturePlan();
    const current = h.api.formDraft(plan);
    assert.match(current.description, /07\/11\/2026, 18:00.*KST/);
    assert.match(current.description, /06\/11\/2026, 18:00.*KST/);
    assert.match(current.description, /Venue: QA Library/);
    assert.match(current.description, /Capacity: 30/);
    assert.equal(current.capacity, 30); assert.equal(current.automationVersion, 1);
    const legacy = h.api.formDraft(plan, 1);
    assert.equal(legacy.description, `${plan.descriptionKo}\n\n${plan.descriptionEn}`);
    assert.equal(legacy.capacity, undefined); assert.equal(legacy.automationVersion, undefined);
    const dateOnly = h.api.formDraft({ ...plan, activityDate: "2026-11-07", applicationDeadline: "2026-11-06" });
    assert.match(dateOnly.description, /Date: 2026-11-07\n/);
    assert.ok(!dateOnly.description.includes("00:00"));
    h.control.currentPlan = { ...plan, applicationDeadline: "2026-11-06" };
    const incomplete = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage + " 2026-11-06" });
    assert.ok(incomplete.missing.includes("applicationDeadlineTime")); assert.equal(incomplete.token, null);
    h.control.currentPlan = plan;
    const job = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    assert.equal(job.job.ai_metadata.formDraftVersion, 2);
    const result = await h.api.studioOperation(h.access(), { action: "approve", jobId: job.job.id, token: job.token, confirmed: true });
    assert.equal(h.control.remoteForms.get(result.form.google_form_id).info.description, current.description);
    assert.deepEqual(result.form.metadata.automation, { version: 1, capacity: 30 });
  } finally { await h.close(); }
});

test("ended event removal preserves original forms, responses, notices and jobs; hides both lists and is idempotent", async () => {
  const h = await eventHarness(); try {
    const planned = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const created = await h.api.studioOperation(h.access(), { action: "approve", jobId: planned.job.id, token: planned.token, confirmed: true });
    const otherPlan = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const other = await h.api.studioOperation(h.access(), { action: "approve", jobId: otherPlan.job.id, token: otherPlan.token, confirmed: true });
    const context = { params: Promise.resolve({ id: created.form.id }) };
    const remoteBefore = JSON.stringify([...h.control.remoteForms]);
    await h.store.db.query("insert into kline_forms_test_google_form_responses(google_form_registry_id,google_response_id,submitted_at,answers_json) values($1,'qa-response',now(),'{\"Name\":[\"Participant\"]}')", [created.form.id]);
    const response = await h.api.deleteEvent(deletionRequest(), context);
    assert.equal(response.status, 200); assert.equal((await response.json()).deleted, true);
    const form = (await h.store.db.query("select * from kline_forms_test_google_forms where id=$1", [created.form.id])).rows[0];
    assert.equal(form.status, "archived"); assert.equal(form.metadata.deletedBy, h.control.email);
    assert.equal((await h.store.db.query("select count(*)::integer as n from kline_forms_test_google_form_responses")).rows[0].n, 1);
    assert.equal((await h.store.db.query("select count(*)::integer as n from kline_forms_test_club_board_posts")).rows[0].n, 2);
    assert.equal((await h.store.db.query("select count(*)::integer as n from kline_forms_test_event_studio_jobs")).rows[0].n, 2);
    assert.equal(JSON.stringify([...h.control.remoteForms]), remoteBefore);
    assert.equal(h.control.externalCreates, 2);
    assert.deepEqual((await (await h.api.listForms()).json()).forms.map(form => form.id), [other.form.id]);
    assert.deepEqual((await h.api.studioOperation(h.access(), { action: "list" })).jobs.map(job => job.id), [other.job.id]);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "get", jobId: planned.job.id }), /EVENT_ARCHIVED/);
    await assert.rejects(h.api.setGoogleFormStatus(form, "open"), /EVENT_ARCHIVED/);
    await assert.rejects(h.api.setGoogleFormStatus(created.form, "draft"), /FORM_CHANGED_REFRESH_REQUIRED/);
    assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 200);
  } finally { await h.close(); }
});

test("event deletion requires club administrator, ended confirmation and same origin", async () => {
  const h = await eventHarness(); try {
    const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) };
    h.control.email = ""; assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 401);
    h.control.email = "member@example.test"; h.control.clubs = []; assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 403);
    h.control.clubs = ["ecc", "hanhwal", "social_impact_union"]; h.control.readOnly = true; assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 403);
    h.control.readOnly = false;
    assert.equal((await h.api.deleteEvent(deletionRequest({}), context)).status, 400);
    assert.equal((await h.api.deleteEvent(deletionRequest(null), context)).status, 400);
    assert.equal((await h.api.deleteEvent(deletionRequest(undefined, "https://untrusted.example"), context)).status, 403);
    assert.equal((await h.api.deleteEvent(deletionRequest(), { params: Promise.resolve({ id: "bad-id" }) })).status, 400);
    assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 404);
  } finally { await h.close(); }
});

test("cross-club and running event deletion is rejected without changing records", async () => {
  const h = await eventHarness(); try {
    const planned = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const created = await h.api.studioOperation(h.access(), { action: "approve", jobId: planned.job.id, token: planned.token, confirmed: true });
    const context = { params: Promise.resolve({ id: created.form.id }) };
    h.control.clubs = ["social_impact_union"];
    assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 404);
    h.control.clubs = ["ecc"];
    await h.store.db.query("update kline_forms_test_event_studio_jobs set state='running' where id=$1", [planned.job.id]);
    assert.equal((await h.api.deleteEvent(deletionRequest(), context)).status, 409);
    assert.equal((await h.store.db.query("select status from kline_forms_test_google_forms where id=$1", [created.form.id])).rows[0].status, "draft");
  } finally { await h.close(); }
});

test("production event key is isolated from the existing general AI credential", async () => {
  const h = await eventHarness(); try {
    process.env.EVENT_AI_OPENAI_API_KEY = "event-specific-server-key";
    assert.equal(h.api.eventAIConfig().key, "event-specific-server-key");
    delete process.env.EVENT_AI_OPENAI_API_KEY;
    assert.equal(h.api.eventAIConfig().key, "qa-only-not-a-real-key");
  } finally { await h.close(); }
});

test("production permits ECC managers only and preserves read-only restrictions", async () => {
  const h = await eventHarness(); try {
    process.env.GOOGLE_FORMS_ENVIRONMENT = "admin-production";
    process.env.GOOGLE_FORMS_ADMIN_PRODUCTION_ENABLED = "true";
    h.control.clubs = ["hanhwal"];
    assert.deepEqual((await h.api.getStudioAccess()).manageableClubs, []);
    h.control.clubs = ["ecc"];
    assert.deepEqual((await h.api.getStudioAccess()).manageableClubs, ["ecc"]);
    h.control.readOnly = true;
    assert.equal((await h.api.getStudioAccess()).readOnly, true);
    h.control.clubs = ["ecc", "hanhwal", "social_impact_union"];
    assert.deepEqual((await h.api.getStudioAccess()).manageableClubs, ["ecc"]);
  } finally { await h.close(); }
});

test("Luna/Sol explicit complexity rules never classify by request length; official prices", async () => {
  const h = await eventHarness(); try {
    for (const request of ["ECC 게더링", "한활 국궁", "SIU culture exchange", "International 문화교류", "simple event ".repeat(300)]) assert.equal(h.api.selectEventModel(request).model, "gpt-6-luna");
    for (const request of ["1박 2일 MT", "multiple locations", "조 조건 균형 조 편성", "multiple dates", "일정 충돌", "archery and meditation"]) assert.equal(h.api.selectEventModel(request).model, "gpt-6.1-sol");
    assert.equal(h.api.estimateEventCost("gpt-6-luna", 1000, 500), 0.00035);
    assert.equal(h.api.estimateEventCost("unknown", 1, 1), null);
  } finally { await h.close(); }
});

test("verified ECC references stay activity-specific and never transfer to other clubs", async () => {
  const h = await eventHarness(); try {
    assert.match(h.api.eventNoticeContext("ecc", "International Gathering"), /Groups change weekly/);
    for (const club of ["hanhwal", "social_impact_union"]) assert.doesNotMatch(h.api.eventNoticeContext(club, "International Gathering"), /Groups change weekly|same-day applications/);
    assert.doesNotMatch(h.api.eventNoticeContext("ecc", "새로운 명상 행사"), /Groups change weekly|same-day applications/);
  } finally { await h.close(); }
});

test("known source-backed notices repair generic AI output without historical fees or invented schedules", async () => {
  const h = await eventHarness(); try {
    h.control.currentPlan = { ...fixturePlan(), noticeKo: "공지\n신청을 받습니다.", noticeEn: "Notice\nApplications are open." };
    const generated = await h.api.generateEventPlan(h.access().email, "ecc", "international gathering. " + fixtureMessage);
    assert.equal(h.control.aiCalls, 1);
    assert.match(generated.plan.noticeKo, /조별 채팅방|조원들이/);
    assert.match(generated.plan.noticeEn, /one day before|meeting place together/);
    assert.match(generated.plan.noticeEn, /own activity costs|restricted/);
    assert.doesNotMatch(generated.plan.noticeKo + generated.plan.noticeEn, /15,?000|Wednesday|Tongjip|process notice/);
    const english = await h.api.generateEventPlan(h.access().email, "ecc", "English Class. " + fixtureMessage);
    assert.match(english.plan.noticeKo, /English Conversation Class|그룹은 매주/);
    assert.doesNotMatch(english.plan.noticeEn, /Thursday, after 6pm/);
  } finally { await h.close(); }
});

test("new activity generic notices retry, proposal labels are required, and unrelated ECC rules are rejected", async () => {
  const h = await eventHarness(); try {
    const weak = { ...fixturePlan(), noticeKo: "문화교류 공지\n참여 신청을 받습니다.", noticeEn: "Culture notice\nApply to participate in this activity." };
    h.control.outputs = [JSON.stringify(weak), JSON.stringify(fixturePlan())];
    const result = await h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage);
    assert.equal(result.metadata.retries, 1);
    assert.match(h.control.requests[1].instructions, /EVENT_NOTICE_TOO_GENERIC/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), noticeKo: fixturePlan().noticeKo.replaceAll("제안", "확정") }, fixtureMessage), /PROPOSAL_LABEL/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), noticeEn: fixturePlan().noticeEn + "\nGroups change weekly based on applicants." }, fixtureMessage), /UNRELATED_RULES/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), location: null }, fixtureMessage), /MISSING_LOGISTICS_LABEL/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), noticeEn: fixturePlan().noticeEn + "\nNo prior experience is needed." }, fixtureMessage), /UNSUPPORTED_ELIGIBILITY/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), noticeEn: fixturePlan().noticeEn + "\nTea and postcards will be provided." }, fixtureMessage), /UNSUPPORTED_MATERIALS/);
    assert.throws(() => h.api.assertNoticeQuality({ ...fixturePlan(), noticeKo: "## " + fixturePlan().noticeKo }, fixtureMessage), /COPY_FORMAT/);
  } finally { await h.close(); }
});
test("strict Responses output and durable per-call telemetry for all three clubs/languages", async () => {
  const h = await eventHarness(); try {
    for (const club of ["ecc", "hanhwal", "social_impact_union"]) {
      h.control.currentPlan = fixturePlan(club);
      const next = await h.api.studioOperation(h.access(), { action: "plan", clubKey: club, message: fixtureMessage });
      assert.equal(next.job.club_key, club); assert.equal(next.job.revision, 1);
      assert.equal(next.creationSupported, club === "ecc");
      const input = h.control.requests.at(-1); assert.equal(input.text.format.strict, true); assert.equal(input.text.format.type, "json_schema"); assert.equal(input.store, false);
    }
    const usage = await h.api.studioOperation(h.access(), { action: "usage", clubKey: "ecc" });
    assert.equal(usage.usage[0].input_tokens, 1000); assert.equal(usage.usage[0].output_tokens, 500); assert.equal(usage.usage[0].status, "completed");
  } finally { await h.close(); }
});
test("config off/missing/masked/model mismatch fails without hidden fallback", async () => {
  const h = await eventHarness(); try {
    const original = { ...process.env };
    for (const [key, value, code] of [["EVENT_AI_ENABLED", "false", "DISABLED"], ["EVENT_AI_PRIMARY_MODEL", "", "CONFIGURATION"], ["OPENAI_API_KEY", "[Sensitive]", "KEY_REQUIRED"], ["EVENT_AI_COMPLEX_MODEL", "gpt-4o", "MISMATCH"]]) {
      process.env[key] = value; await assert.rejects(h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage), new RegExp(code)); Object.assign(process.env, original);
    }
    assert.equal(h.control.aiCalls, 0);
  } finally { await h.close(); }
});
test("missing date, deadline, venue or capacity remains an editable draft and blocks creation", async () => {
  const h = await eventHarness(); try {
    for (const field of ["activityDate", "applicationDeadline", "location", "capacity"]) {
      h.control.currentPlan = { ...fixturePlan(), [field]: null,
        noticeKo: fixturePlan().noticeKo + "\n미확정 정보는 운영진 확인 후 안내합니다.",
        noticeEn: fixturePlan().noticeEn + "\nPending details will be announced after organizer confirmation." };
      const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
      assert.ok(r.missing.includes(field)); assert.equal(r.token, null);
      await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: "", confirmed: true }));
    }
    assert.equal(h.control.externalCreates, 0);
  } finally { await h.close(); }
});
test("business validation rejects dates, duplicate/sensitive questions and invalid choices", async () => {
  const h = await eventHarness(); try {
    const p = fixturePlan();
    assert.throws(() => h.api.parseEventPlan({ ...p, applicationDeadline: "2026-11-09" }, "ecc"), /DEADLINE_AFTER/);
    assert.throws(() => h.api.parseEventPlan({ ...p, activityDate: "2026-02-30", applicationDeadline: null }, "ecc"), /INVALID_EVENT_DATE/);
    for (const title of ["Health", "Email", "Religion", "Passport", "Phone", "성적 지향"]) assert.throws(() => h.api.parseEventPlan({ ...p, questions: [...p.questions, { ...p.questions[0], id: "extra", title }] }, "ecc"), /SENSITIVE/);
    assert.throws(() => h.api.parseEventPlan({ ...p, questions: [...p.questions, { ...p.questions[0], id: "extra" }] }, "ecc"), /DUPLICATE/);
    assert.throws(() => h.api.parseEventPlan({ ...p, questions: [p.questions[0], { ...p.questions[1], options: ["yes", "yes"] }] }, "ecc"), /DUPLICATE/);
    assert.throws(() => h.api.parseEventPlan({ ...p, questions: [{ ...p.questions[0], type: "fake" }] }, "ecc"), /INVALID/);
    assert.throws(() => h.api.assertGrounded({ ...p, capacity: 100 }, fixtureMessage), /UNSUPPORTED/);
    assert.throws(() => h.api.assertGrounded({ ...p, location: "Invented Venue" }, fixtureMessage), /UNSUPPORTED/);
  } finally { await h.close(); }
});
test("bounded malformed JSON retry does not upgrade for syntax; repeated business error upgrades once", async () => {
  const h = await eventHarness(); try {
    h.control.outputs = ["bad", "bad", "bad"];
    await assert.rejects(h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage), /FORMAT_INVALID/);
    assert.equal(h.control.aiCalls, 3); assert.ok(h.control.requests.every(r => r.model === "gpt-6-luna"));
    const invalid = JSON.stringify({ ...fixturePlan(), location: "Invented" });
    h.control.outputs = [invalid, invalid, JSON.stringify(fixturePlan())];
    const generated = await h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage);
    assert.equal(generated.metadata.model, "gpt-6.1-sol"); assert.equal(generated.metadata.reason, "repeated_business_validation_failure");
  } finally { await h.close(); }
});
test("OpenAI auth/unavailable/rate errors stop after one call and do not log response text", async () => {
  const h = await eventHarness(); try {
    for (const status of [401, 404, 429, 500]) { h.control.aiStatus = status; await assert.rejects(h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage)); }
    assert.equal(h.control.aiCalls, 4);
    const rows = (await h.store.db.query("select * from kline_forms_test_event_ai_usage")).rows;
    assert.equal(rows.length, 4); assert.ok(rows.every(row => row.status === "failed" && row.error_code)); assert.ok(!JSON.stringify(rows).includes("QA failure"));
  } finally { await h.close(); }
});
test("ECC approval creates one private form, persists actual application link, replay has no duplicate", async () => {
  const h = await eventHarness(); try {
    const initial = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    assert.equal(h.control.externalCreates, 0);
    const approval = { action: "approve", jobId: initial.job.id, token: initial.token, confirmed: true };
    const done = await h.api.studioOperation(h.access(), approval);
    assert.equal(done.job.state, "notice_saved"); assert.equal(done.recruitmentOpen, false);
    assert.equal(h.control.externalCreates, 1); assert.equal(done.form.status, "draft");
    assert.ok(h.control.remoteForms.values().next().value.items[0].questionItem.question.required);
    const notice = (await h.store.db.query("select content,status from kline_forms_test_club_board_posts")).rows[0];
    assert.equal(notice.status, "draft"); assert.ok(notice.content.includes(done.applicationUrl)); assert.ok(!done.notice.includes(done.applicationUrl));
    const replay = await h.api.studioOperation(h.access(), approval);
    assert.equal(replay.form.google_form_id, done.form.google_form_id); assert.equal(h.control.externalCreates, 1);
  } finally { await h.close(); }
});
test("web uses saved draft service; changed draft invalidates previous approval", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const request = new Request("http://localhost/api/event-studio", { method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ action: "get", jobId: r.job.id }) });
    const web = await h.api.POST(request); assert.equal(web.status, 200); assert.equal((await web.json()).job.id, r.job.id);
    const edited = await h.api.studioOperation(h.access(), { action: "update", jobId: r.job.id, revision: 1, plan: { ...r.job.plan, title: "Changed title" } });
    assert.equal(edited.job.revision, 2);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: r.token, confirmed: true }), /APPROVAL_EXPIRED_OR_CHANGED/);
    assert.equal(h.control.externalCreates, 0);
    const source = await readFile("src/app/api/event-studio/route.ts", "utf8"); assert.match(source, /studioOperation\(await getStudioAccess\(\)/);
  } finally { await h.close(); }
});
test("expired, tampered, missing approval and wrong actor cannot create", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const payload = JSON.parse(Buffer.from(r.token.split(".")[0], "base64url").toString());
    for (const token of [r.token + "x", h.api.createSignedWoohyukmonPayload({ ...payload, expires: Date.now() - 1 }), h.api.createSignedWoohyukmonPayload({ ...payload, actor: "other@example.test" })]) await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token, confirmed: true }));
    await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: r.token }));
    assert.equal(h.control.externalCreates, 0);
  } finally { await h.close(); }
});
test("ordinary/read-only/cross-club managers and cross-origin requests fail closed", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.clubs = ["hanhwal"];
    await assert.rejects(h.api.studioOperation(h.access(), { action: "get", jobId: r.job.id }), /NOT_FOUND/);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage }), /ADMIN/);
    h.control.clubs = []; await assert.rejects(h.api.studioOperation(h.access(), { action: "list" }), /ADMIN/);
    h.control.clubs = ["ecc"]; h.control.readOnly = true;
    await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: r.token, confirmed: true }), /READ_ONLY/);
    const crossOrigin = await h.api.POST(new Request("http://localhost/api/event-studio", { method: "POST", headers: { origin: "https://evil.test" }, body: "{}" })); assert.equal(crossOrigin.status, 403);
    h.control.email = "";
    const anon = await h.api.POST(new Request("http://localhost/api/event-studio", { method: "POST", headers: { origin: "http://localhost" }, body: '{"action":"list"}' })); assert.equal(anon.status, 401);
  } finally { await h.close(); }
});
test("form succeeds + notice fails: recovery uses existing remote form; uncertain create is never retried", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const approval = { action: "approve", jobId: r.job.id, token: r.token, confirmed: true };
    h.control.failNotice = true; await assert.rejects(h.api.studioOperation(h.access(), approval));
    h.control.failNotice = false;
    const done = await h.api.studioOperation(h.access(), approval); assert.equal(done.job.state, "notice_saved"); assert.equal(h.control.externalCreates, 1);
    const second = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.failGoogle = true;
    const bad = { action: "approve", jobId: second.job.id, token: second.token, confirmed: true };
    await assert.rejects(h.api.studioOperation(h.access(), bad)); await assert.rejects(h.api.studioOperation(h.access(), bad), /UNCERTAIN/);
    assert.equal(h.control.externalCreates, 2);
  } finally { await h.close(); }
});
test("Google OAuth expiry and missing response links cannot save notices", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.failOAuth = true; await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: r.token, confirmed: true }), /RECONNECT/);
    h.control.failOAuth = false;
    const s = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.missingUrl = true; await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: s.job.id, token: s.token, confirmed: true }));
    assert.equal((await h.store.db.query("select count(*)::int as count from kline_forms_test_club_board_posts")).rows[0].count, 0);
  } finally { await h.close(); }
});
test("persisted quotas honor user and club caps; SQL additive, RLS and RPC deny browsers", async () => {
  const h = await eventHarness(); try {
    await h.api.studioOperation(h.access(), { action: "limits", clubKey: "ecc", userDailyLimit: 1, clubDailyLimit: 2 });
    await h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage);
    await assert.rejects(h.api.generateEventPlan(h.access().email, "ecc", fixtureMessage), /QUOTA/);
    await h.api.generateEventPlan("another@example.test", "ecc", fixtureMessage);
    await assert.rejects(h.api.generateEventPlan("third@example.test", "ecc", fixtureMessage), /QUOTA/);
    assert.equal(h.control.aiCalls, 2);
    const sql = await readFile("supabase/migrations/20261010172743_event_studio.sql", "utf8");
    await h.store.db.exec("reset role"); await h.store.db.exec(sql);
    assert.equal((await h.store.db.query("select count(*)::int as n from kline_forms_test_event_ai_usage")).rows[0].n, 2);
    for (const role of ["anon", "authenticated"]) {
      await h.store.db.exec(`set role ${role}`);
      await assert.rejects(h.store.db.query("select * from kline_forms_test_event_studio_jobs"), /permission denied/);
      await assert.rejects(h.store.db.query("select kline_forms_test_event_ai_reserve('user','ecc','gpt-6-luna','simple',0)"), /permission denied/);
      await h.store.db.exec("set role service_role");
    }
  } finally { await h.close(); }
});

test("concurrent approval creates one remote form; stale running work requires fresh review", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    const command = { action: "approve", jobId: r.job.id, token: r.token, confirmed: true };
    const results = await Promise.allSettled([h.api.studioOperation(h.access(), command), h.api.studioOperation(h.access(), command)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(h.control.externalCreates, 1);
    const s = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    await h.store.db.query("update kline_forms_test_event_studio_jobs set state='running' where id=$1", [s.job.id]);
    await assert.rejects(h.api.studioOperation(h.access(), { action: "recover", jobId: s.job.id }), /WAIT/);
    await h.store.db.query("update kline_forms_test_event_studio_jobs set updated_at=now()-interval '10 minutes' where id=$1", [s.job.id]);
    const recovered = await h.api.studioOperation(h.access(), { action: "recover", jobId: s.job.id });
    assert.equal(recovered.job.state, "failed"); assert.ok(recovered.token);
    await h.api.studioOperation(h.access(), { action: "approve", jobId: s.job.id, token: recovered.token, confirmed: true });
    assert.equal(h.control.externalCreates, 2);
  } finally { await h.close(); }
});

test("remote question edits cannot pass as the approved form or save a notice", async () => {
  const h = await eventHarness(); try {
    const r = await h.api.studioOperation(h.access(), { action: "plan", clubKey: "ecc", message: fixtureMessage });
    h.control.failNotice = true;
    await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: r.token, confirmed: true }));
    h.control.failNotice = false;
    const remote = [...h.control.remoteForms.values()][0];
    remote.items[0].questionItem.question.required = false;
    const review = await h.api.studioOperation(h.access(), { action: "review", jobId: r.job.id });
    await assert.rejects(h.api.studioOperation(h.access(), { action: "approve", jobId: r.job.id, token: review.token, confirmed: true }), /CONTENT_MISMATCH/);
    assert.equal(h.control.externalCreates, 1);
    assert.equal((await h.store.db.query("select count(*)::int as n from kline_forms_test_club_board_posts")).rows[0].n, 0);
  } finally { await h.close(); }
});


test("explicit Korean dates preserve year, clock precision and timezone grounding", async () => {
  const h = await eventHarness(); try {
    const message = "행사 2026년 10월 20일 오후 7시(한국시간), 마감 2026년 10월 19일 오후 6시(한국시간)";
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:00+09:00", message), true);
    assert.equal(h.api.supportsEventDate("2026-10-19T18:00:00+09:00", message), true);
    assert.equal(h.api.supportsEventDate("2026-10-20T20:00:00+09:00", message), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:01+09:00", message), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:00Z", message), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:00+09:00", "2026년 10월 20일 오후 7시"), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:00+09:00", "10월 20일 오후 7시 한국시간"), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T19:00:00+09:00", "2026년 10월 20일 한국시간"), false);
    assert.equal(h.api.supportsEventDate("2026-10-20", "2026년 10월 20일"), true);
    assert.equal(h.api.supportsEventDate("2026-10-20", "2026년 13월 20일"), false);
    assert.equal(h.api.supportsEventDate("2026-03-02", "2026년 2월 30일"), false);
    assert.equal(h.api.supportsEventDate("2026-10-20T00:00:00+09:00", "2026년 10월 20일 오전 12시 KST"), true);
    assert.equal(h.api.supportsEventDate("2026-10-20T12:30:00+09:00", "2026년 10월 20일 오후 12시 30분 KST"), true);
    const p = { ...fixturePlan(), activityDate: "2026-10-20T19:00:00+09:00", applicationDeadline: "2026-10-19T18:00:00+09:00" };
    h.control.currentPlan = p;
    const generated = await h.api.generateEventPlan(h.access().email, "ecc", message + ", 장소 QA Library, 30명");
    assert.equal(generated.plan.activityDate, p.activityDate);
    assert.equal(h.control.aiCalls, 1);
  } finally { await h.close(); }
});

test("only writable superadmins can reconnect production Forms; club admins stay restricted", async () => {
  const h = await eventHarness(); try {
    process.env.GOOGLE_FORMS_ENVIRONMENT = "admin-production";
    process.env.GOOGLE_FORMS_ADMIN_PRODUCTION_ENABLED = "true";
    assert.equal((await h.api.getGoogleFormsAccess()).canConnect, true);
    h.control.readOnly = true;
    assert.equal((await h.api.getGoogleFormsAccess()).canConnect, false);
    h.control.readOnly = false; h.control.clubs = ["ecc"];
    assert.equal((await h.api.getGoogleFormsAccess()).canConnect, false);
    h.control.email = "";
    assert.equal((await h.api.getGoogleFormsAccess()).canConnect, false);
  } finally { await h.close(); }
});
