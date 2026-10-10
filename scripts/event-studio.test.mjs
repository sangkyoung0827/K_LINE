import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { eventHarness, fixturePlan, fixtureMessage } from "./event-studio-harness.mjs";

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
      h.control.currentPlan = { ...fixturePlan(), [field]: null };
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
