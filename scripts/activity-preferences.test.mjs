import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const root = resolve("src/lib/activity-preferences");
const copy = (value) => JSON.parse(JSON.stringify(value));
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Date, Error, URL, Response, Request, Headers, AbortSignal, setTimeout, clearTimeout, console: { warn() {}, error() {} }, process })((name) => {
      if (name in stubs) return stubs[name];
      if (name === "server-only") return {};
      if (name === "@/lib/supabaseServer") return { supabaseRequest: async () => { throw Error("No live DB in tests"); } };
      const path = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(file), name);
      if (existsSync(`${path}.ts`)) return load(`${path}.ts`);
      throw Error(`Unmocked dependency: ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const { preferenceConfig: config } = load(`${root}/config.ts`);
const { applicationPreferenceEvent } = load(`${root}/adapters/applications.ts`);
const { ratingPreferenceEvent } = load(`${root}/adapters/ratings.ts`);
const { aggregatePreferenceEvents } = load(`${root}/aggregate.ts`);
const { toPreferenceProfile } = load(`${root}/profile.ts`);
const { rankWithPreferenceProfile } = load(`${root}/recommend.ts`);
const { isActivityPreferenceRequest } = load(`${root}/intent.ts`);
const now = "2026-09-14T00:00:00.000Z";
const mapping = { source: "ecc", activity_id: "opening", canonical_title: "Opening", categories: ["social_networking"], tags: ["new_semester","networking"], is_active: true };
const application = (id = "one", extra = {}) => ({ id, user_id: " A@EXAMPLE.TEST ", activity_id: "opening", activity_instance_id: null, created_at: now, ...extra });
const applied = (id = "one", map = mapping) => applicationPreferenceEvent("ecc", application(id), map);
const rated = (rating) => ratingPreferenceEvent({ id: `rating-${rating}`, user_id: "a@example.test", source: "ecc", activity_id: "opening", activity_instance_id: null, rating, rated_at: now }, mapping);
const category = (events) => aggregatePreferenceEvents(events, now).find((d) => d.dimension_type === "category");

test("one real application creates only an applied interest event with normalized identity", () => {
  assert.equal(applied().event_type, "applied"); assert.equal(applied().source_event_key, "ecc_application:one");
  assert.equal(applied().user_key, "a@example.test"); assert.equal(applied().base_weight, 2);
});
test("application increases category affinity; repeats add evidence without unlimited affinity", () => {
  assert.ok(category([applied()]).affinity_score > 50);
  const many = category(Array.from({ length: 10 }, (_, i) => applied(String(i))));
  assert.ok(many.affinity_score > category([applied()]).affinity_score); assert.ok(many.affinity_score <= 100);
  assert.equal(many.application_count, 10);
});
for (const [rating, weight] of [[5,4],[4,2],[3,0],[2,-1],[1,-3]]) test(`${rating}-star rating uses explicit weight ${weight}`, () => {
  const d = category([rated(rating)]); assert.equal(d.raw_score, weight); assert.equal(d.average_rating, rating);
  if (weight > 0) assert.ok(d.affinity_score > 50);
  if (weight < 0) assert.ok(d.affinity_score < 50);
  if (!weight) assert.equal(d.affinity_score, 50);
});
test("one signal has low confidence; repeated signals increase confidence independently", () => {
  assert.ok(category([rated(5)]).confidence < 0.3);
  assert.ok(category([applied(),rated(5)]).confidence > category([rated(5)]).confidence);
});
test("no data is neutral and unknown, not dislike", () => {
  const profile = toPreferenceProfile({ state: null, dimensions: [] }, now);
  assert.equal(profile.categories.length, 14); assert.ok(profile.categories.every((d) => d.affinity === 50 && d.confidence === 0));
});
test("localized titles do not affect canonical identity; organizations stay separate", () => {
  const ko = applicationPreferenceEvent("ecc", application("same", { activity_title: "개강총회 신청" }), mapping);
  const en = applicationPreferenceEvent("ecc", application("same", { activity_title: "Semester Opening Party Application" }), mapping);
  assert.deepEqual(copy(ko), copy(en));
  assert.notEqual(applicationPreferenceEvent("hanhwal", application("same"), mapping).source_event_key, ko.source_event_key);
  assert.deepEqual(copy(applicationPreferenceEvent("hanhwal", application("same"), mapping).categories), []);
});
test("duplicate source keys cannot double count", () => assert.equal(category([applied(), applied()]).application_count, 1));
test("multi-category activities and tags receive full weights once per unique dimension", () => {
  const event = applied("multi", { ...mapping, categories: ["culture_tradition","wellness","travel","travel"], tags: ["temple","weekend"] });
  const rows = aggregatePreferenceEvents([event], now);
  assert.equal(rows.length, 5); assert.ok(rows.every((d) => d.raw_score === 2 && d.signal_count === 1));
});
test("180-day half-life and read-time decay are deterministic", () => {
  const old = { ...applied(), occurred_at: new Date(Date.parse(now)-180*86400000).toISOString() };
  assert.equal(category([old]).raw_score, 1);
  const profile = toPreferenceProfile({ state: { computed_at: old.occurred_at }, dimensions: category([applied()]) ? [category([applied()])] : [] }, now);
  assert.equal(profile.categories.find((d) => d.id === "social_networking").rawScore, 1);
});
test("unknown mapping retains an unclassified event; missing identity is not guessed", () => {
  assert.deepEqual(copy(applied("unknown", null).categories), []);
  assert.equal(applicationPreferenceEvent("ecc", application("missing", { user_id: null, name: "Somebody" }), mapping), null);
});
test("demographic, financial, message and location fields never enter event payload", () => {
  const privateFields = { gender: "X", nationality: "X", student_id: "X", department: "X", phone: "X", kakao_id: "X", allergy: "X", gps: "X", status: "paid", messages: ["X"] };
  assert.deepEqual(copy(applicationPreferenceEvent("ecc", application("one", privateFields), mapping)), copy(applied()));
});
test("record without both rating and timestamp produces no signal of any kind", () => {
  for (const values of [{ rating: null, rated_at: now }, { rating: 5, rated_at: null }, { rating: null, rated_at: null }]) assert.equal(ratingPreferenceEvent({ ...application(), source: "ecc", ...values }, mapping), null);
});
test("equivalent rating timestamps use the same deterministic key", () => {
  const row = { ...application(), source: "ecc", rating: 5, rated_at: now };
  assert.equal(ratingPreferenceEvent(row, mapping).source_event_key, ratingPreferenceEvent({ ...row, rated_at: "2026-09-14T09:00:00+09:00" }, mapping).source_event_key);
});
test("future and attendance signal types cannot be written in V1", async () => {
  const { recordPreferenceEvent } = load(`${root}/events.ts`);
  for (const type of ["attended", "attendance", "created_activity", "explicit_preference"]) await assert.rejects(recordPreferenceEvent({ ...applied(), event_type: type }, async () => { assert.fail("Must not write"); }));
});
test("self API ignores attacker-selected identity and requires current session", async () => {
  let requested;
  const route = loader({ "@/auth": { auth: async () => ({ user: { email: " ME@EXAMPLE.TEST " } }) },
    "@/lib/activity-preferences/server": { getUserActivityPreferenceProfile: async (key) => { requested = key; return { categories: [] }; } }
  })("src/app/api/activity-preferences/me/route.ts");
  const response = await route.GET(new Request("https://test/api/activity-preferences/me?email=victim@example.test"));
  assert.equal(requested, "me@example.test"); assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/); assert.equal(route.POST, undefined);
  const guest = loader({ "@/auth": { auth: async () => null } })("src/app/api/activity-preferences/me/route.ts");
  assert.equal((await guest.GET()).status, 401);
});
test("preference scheduling failure and task rejection are both contained", async () => {
  let callback;
  const hooks = loader({ "next/server": { after: (task) => { callback = task; } } })(`${root}/hooks.ts`);
  hooks.schedulePreferenceAttempt(async () => { throw Error("DB unavailable"); });
  await callback();
  const broken = loader({ "next/server": { after: () => { throw Error("No scheduler"); } } })(`${root}/hooks.ts`);
  assert.doesNotThrow(() => broken.schedulePreferenceAttempt(async () => {}));
});
test("preference intents are narrowly routed without affecting ordinary chat", () => {
  for (const message of ["내가 어떤 활동을 좋아해?", "내 취향 분석해줘", "나한테 맞는 활동 추천해줘", "이번 주말에 뭐 하는 게 좋을까?", "ECC랑 소셜유니온 활동 중 뭐가 나한테 맞아?", "내가 지금까지 어떤 활동에 관심이 많았어?", "Recommend activities for me", "What are my interests?"]) assert.equal(isActivityPreferenceRequest(message), true, message);
  for (const message of ["안녕", "ECC 신청자 명단", "회비 납부했어", "회원 수 알려줘", "외부 검색으로 전통주 조사해줘"]) assert.equal(isActivityPreferenceRequest(message), false, message);
});
test("Woohyukmon summary reads calculated values, no data stays unknown and unrelated chat does not query", async () => {
  const summaryModule = loader({ "@/lib/eccOperations": { getEccActivityCatalog: async () => [] } })(`${root}/woohyukmon.ts`);
  const profile = toPreferenceProfile({ state: { application_count: 1, rating_count: 0, unmapped_count: 0, computed_at: now }, dimensions: aggregatePreferenceEvents([applied()], now) }, now);
  const summary = summaryModule.summarizePreferenceProfile(profile);
  assert.equal(summary.emergingCategories[0].affinity, profile.categories[0].affinity);
  assert.equal(summary.emergingCategories[0].confidence, profile.categories[0].confidence);
  assert.ok(summary.insufficientData.includes("volunteering"));
  assert.equal((await summaryModule.activityPreferenceContextForMessage("안녕", "test@example.test")).text, "");
  assert.match((await summaryModule.activityPreferenceContextForMessage("내 취향 분석", null)).text, /login required/);
  assert.doesNotMatch(readFileSync(`${root}/woohyukmon.ts`, "utf8"), /recordPreferenceEvent|recomputeUser|method:\s*"(?:POST|PATCH)"/);
});
test("recommendations use affinity and confidence, unknown categories rank neutrally", () => {
  const profile = toPreferenceProfile({ state: null, dimensions: aggregatePreferenceEvents([applied()], now) }, now);
  const ranked = rankWithPreferenceProfile(profile, [
    { source: "future", activityId: "volunteer", categories: ["volunteering"], tags: [] },
    { source: "ecc", activityId: "opening", categories: ["social_networking"], tags: ["networking"] }
  ]);
  assert.equal(ranked[0].activityId, "opening"); assert.equal(ranked[1].matchScore, 50);
});

test("PostgreSQL migration twice, idempotent events/backfill, atomic profiles, RLS and zero source changes", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table source_sentinel(id int primary key, value text); insert into source_sentinel values(1,'untouched');");
    const migration = readFileSync("supabase/activity_preferences_v1.sql", "utf8");
    await db.exec(migration); await db.exec(migration);
    const event = applied();
    const insert = async (e) => (await db.query("select public.record_activity_preference_event($1::jsonb) result", [JSON.stringify(e)])).rows[0].result;
    assert.equal((await insert(event)).inserted, true);
    assert.equal((await insert(event)).inserted, false);
    await insert(rated(5));
    await assert.rejects(insert({ ...event, user_key: "victim@example.test" }), /IDENTITY_CONFLICT/);
    await assert.rejects(insert({ ...event, source_event_key: "bad", event_type: "attended" }));
    const recompute = async () => db.query("select public.recompute_activity_preferences($1,$2,'v1',$3,$4,$5)", [event.user_key,new Date().toISOString(),config.halfLifeDays,config.affinityScale,config.confidenceScale]);
    await recompute(); await recompute();
    const stored = (await db.query("select public.read_activity_preference_profile($1) result", [event.user_key])).rows[0].result;
    const expected = aggregatePreferenceEvents([event,rated(5)], stored.state.computed_at);
    for (const row of stored.dimensions) {
      const matching = expected.find((d) => d.dimension_type === row.dimension_type && d.dimension_key === row.dimension_key);
      assert.ok(Math.abs(Number(row.raw_score)-matching.raw_score)<0.00001);
      assert.ok(Math.abs(Number(row.affinity_score)-matching.affinity_score)<0.00001);
      assert.ok(Math.abs(Number(row.confidence)-matching.confidence)<0.00001);
    }
    assert.equal(stored.state.application_count, 1); assert.equal(stored.state.rating_count, 1);
    // Reclassification removes old derived dimensions without deleting history.
    await db.exec("update public.activity_preference_activity_map set categories=array['culture_tradition'],tags='{}' where source='ecc' and activity_id='opening'");
    await insert(event); await insert(rated(5)); await recompute();
    const changed = (await db.query("select public.read_activity_preference_profile($1) result", [event.user_key])).rows[0].result;
    assert.equal(changed.dimensions.length, 1); assert.equal(changed.dimensions[0].dimension_key, "culture_tradition");
    const health = (await db.query("select public.activity_preference_diagnostics() result")).rows[0].result;
    assert.equal(health.events, 2); assert.equal(health.uniqueEventKeys, 2); assert.equal(health.attendanceEvents, 0);
    assert.deepEqual((await db.query("select * from source_sentinel")).rows, [{ id: 1, value: "untouched" }]);
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from public.activity_preference_events"), /permission denied/);
    await assert.rejects(db.query("select public.read_activity_preference_profile('a@example.test')"), /permission denied/);
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from public.user_activity_preferences"), /permission denied/);
    await db.exec("reset role");
    const rls = (await db.query("select relrowsecurity from pg_class where relname in ('activity_preference_events','activity_preference_activity_map','user_activity_preferences','activity_preference_profile_state','activity_preference_reconciliation_runs')")).rows;
    assert.equal(rls.length, 5); assert.ok(rls.every((r) => r.relrowsecurity));
  } finally { await db.close(); }
});

for (const source of ["ecc", "hanhwal"]) test(`${source} application succeeds even when the real secondary preference task fails`, async () => {
  let task, primaryWrites = 0;
  const access = { isLoggedIn: true, isOfficialMember: true, isAdmin: false, email: "me@example.test" };
  class SupabaseRequestError extends Error {}
  const shared = {
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) }, after: (fn) => { task = fn; } },
    "@/lib/supabaseServer": { SupabaseRequestError, SupabaseConfigError: class extends Error {}, cleanText: (x) => typeof x === "string" ? x.trim() : "",
      supabaseRequest: async (path, init = {}) => {
        if (path.startsWith("activity_preference") || path.startsWith("rpc/")) throw Error("Analytics unavailable");
        if (init.method === "POST") { primaryWrites++; return [{ id: "submitted", created_at: now }]; }
        return [];
      }
    },
    [`@/lib/${source === "ecc" ? "eccAccess" : "hanhwalAccess"}`]: { [source === "ecc" ? "getCurrentEccAccess" : "getCurrentHanhwalAccess"]: async () => access },
    [`@/lib/${source === "ecc" ? "eccActivityStatuses" : "hanhwalActivityStatuses"}`]: { [source === "ecc" ? "getEccActivityStatuses" : "getHanhwalActivityStatuses"]: async () => ({ statuses: { opening: true }, activityInstances: { opening: "00000000-0000-0000-0000-000000000001" }, requiresPayment: {} }) },
    "@/lib/eccOperations": { getEccActivityCatalog: async () => [{ id: "opening", titleEn: "Opening", titleKo: "개강총회" }] }
  };
  const route = loader(shared)(`src/app/api/${source}/applications/route.ts`);
  const response = await route.POST({ json: async () => ({ activity_id: "opening", name: "Test", gender: "X", nationality: "X", preferred_food: "X" }) });
  assert.equal(response.status, 201); assert.equal(primaryWrites, 1);
  assert.ok(task); await task(); assert.equal(primaryWrites, 1);
});
test("rating success survives preference failure; dismissal never creates a preference event", async () => {
  let task;
  const route = loader({
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) }, after: (fn) => { task = fn; } },
    "@/auth": { auth: async () => ({ user: { email: "me@example.test" } }) },
    "@/lib/admin": { normalizeEmail: (x) => x.toLowerCase() },
    "@/lib/userActivityRecords": { rateActivityRecord: async () => ({ id: "record" }), dismissActivityRecord: async () => ({ id: "record" }) }
  })("src/app/api/activity-history/rating/route.ts");
  assert.equal((await route.PATCH({ json: async () => ({ recordId: "record", action: "rate", rating: 5 }) })).status, 200);
  assert.ok(task); await task(); task = null;
  assert.equal((await route.PATCH({ json: async () => ({ recordId: "record", action: "dismiss" }) })).status, 200);
  assert.equal(task, null);
});

test("real reconciliation paginates, runs twice safely, remaps unknown events, and never writes source tables", async () => {
  const events = new Map();
  const data = {
    activity_preference_activity_map: [{ ...mapping, id: "map-1" }],
    ecc_activity_applications: [application("app1"), application("app2", { activity_id: "unknown" }), application("legacy", { user_id: null })],
    hanhwal_activity_applications: [application("han1")],
    user_activity_records: [{ ...application("rate1"), source: "ecc", rating: 5, rated_at: now }]
  };
  const profiles = new Set();
  const store = async (path, init = {}) => {
    if (path === "rpc/record_activity_preference_event") {
      const event = JSON.parse(init.body).p_event;
      const inserted = !events.has(event.source_event_key); events.set(event.source_event_key, event); return { inserted };
    }
    if (path === "rpc/recompute_activity_preferences") { profiles.add(JSON.parse(init.body).p_user_key); return null; }
    const [table, query] = path.split("?");
    if (init.method === "POST" && table === "activity_preference_reconciliation_runs") return [{ id: "run" }];
    if (init.method === "PATCH" && table === "activity_preference_reconciliation_runs") return null;
    assert.ok(!init.method || init.method === "GET", `Unexpected source mutation ${path}`);
    const params = new URLSearchParams(query);
    const rows = table === "activity_preference_events" ? [...events.values()] : data[table];
    assert.ok(rows, path);
    const offset = Number(params.get("offset") ?? 0);
    return rows.slice(offset, offset+1); // Server cap smaller than requested page size.
  };
  const { reconcileActivityPreferences } = load(`${root}/reconcile.ts`);
  const dryRun = await reconcileActivityPreferences({ store });
  assert.equal(events.size, 0); assert.equal(dryRun.validSourceEvents, 4); assert.equal(dryRun.skippedMissingIdentityOrInvalid, 1);
  const first = await reconcileActivityPreferences({ store, apply: true });
  assert.equal(first.errors, 0); assert.equal(first.newEvents, 4); assert.equal(first.profilesRecomputed, 1);
  assert.equal(first.unmappedActivities.length, 2);
  const second = await reconcileActivityPreferences({ store, apply: true });
  assert.equal(second.newEvents, 0); assert.equal(second.alreadyPresent, 4); assert.equal(events.size, 4);
  data.activity_preference_activity_map.push({ ...mapping, id: "map-2", activity_id: "unknown", categories: ["travel"] });
  await reconcileActivityPreferences({ store, apply: true });
  assert.deepEqual(events.get("ecc_application:app2").categories, ["travel"]);
  assert.ok([...events.values()].every((event) => ["applied", "rating_submitted"].includes(event.event_type)));
});
