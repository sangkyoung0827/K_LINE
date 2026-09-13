import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

class SupabaseRequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
class SupabaseConfigError extends Error {}
const next = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } };
const cleanText = (value, limit = 240) => typeof value === "string" ? value.trim().slice(0, limit) : "";
function load(file, stubs = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    Error, Date, URL, console: { error() {} }
  })((name) => {
    if (name in stubs) return stubs[name];
    throw Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const days = load("src/lib/eccGatheringDays.ts");
const activities = load("src/lib/eccActivities.ts");
const readonly = load("src/lib/readOnlyDeveloper.ts");
const copy = (value) => JSON.parse(JSON.stringify(value));
const catalog = [{ id: "gathering", titleEn: "International Gathering", titleKo: "국제 교류 모임", archived: false }, { id: "mt", titleEn: "MT", archived: false }];
const status = { statuses: { gathering: true, mt: true }, activityInstances: { gathering: "instance-1" }, requiresPayment: {} };
const settingsResult = { gatheringOpenDays: ["monday", "wednesday"], gatheringDaysReady: true };

test("weekday parsing accepts independent days and both, rejects malformed/duplicate choices", () => {
  for (const value of [[], ["monday"], ["wednesday"], ["monday", "wednesday"]]) assert.deepEqual(copy(days.parseEccGatheringDays(value)), value);
  assert.deepEqual(copy(days.parseEccGatheringDays(["wednesday", "monday"])), ["monday", "wednesday"]);
  for (const value of [undefined, null, "monday", ["Monday"], ["friday"], ["monday", "monday"], [null], {}]) assert.equal(days.parseEccGatheringDays(value), null);
  assert.equal(days.validEccGatheringSelection([], ["monday"]), false);
  assert.equal(days.validEccGatheringSelection(["monday", "wednesday"], ["monday"]), false);
  assert.equal(days.validEccGatheringSelection(["wednesday"], []), false);
});

function settingsHarness(query) {
  return load("src/lib/eccGatheringSettings.ts", {
    "server-only": {}, "@/lib/eccGatheringDays": days,
    "@/lib/supabaseServer": { supabaseRequest: query, SupabaseRequestError }
  });
}

test("settings are uncached, migration absence fails closed, outages are not disguised as missing columns", async () => {
  const settings = settingsHarness(async (path, init) => {
    assert.equal(init.cache, "no-store"); return [{ gathering_open_days: [] }];
  });
  assert.deepEqual(copy(await settings.getEccGatheringSettings()), { gatheringOpenDays: [], gatheringDaysReady: true });
  const missing = settingsHarness(async () => { throw new SupabaseRequestError("column gathering_open_days does not exist"); });
  assert.equal((await missing.getEccGatheringSettings()).gatheringDaysReady, false);
  const outage = settingsHarness(async () => { throw new SupabaseRequestError("timeout", 503); });
  await assert.rejects(outage.getEccGatheringSettings());
});

test("weekday-only update does not alter any activity switch, payment requirement or instance", async () => {
  let write;
  const settings = settingsHarness(async (path, init) => {
    assert.ok(path.startsWith("ecc_activity_statuses?activity_id=eq.gathering&"));
    if (init.method === "PATCH") { write = JSON.parse(init.body); return [{ activity_id: "gathering" }]; }
    return [{ gathering_open_days: write.gathering_open_days }];
  });
  assert.deepEqual(copy((await settings.updateEccGatheringSettings(["wednesday"], "admin@test")).gatheringOpenDays), ["wednesday"]);
  assert.deepEqual(Object.keys(write).sort(), ["gathering_open_days", "updated_at", "updated_by"]);
});

function settingsRoute(access, save) {
  return load("src/app/api/ecc/activity-statuses/route.ts", {
    "next/server": next, "@/lib/eccActivities": activities,
    "@/lib/eccAccess": { getCurrentEccAccess: async () => access },
    "@/lib/eccOperations": { getEccActivityCatalog: async () => catalog },
    "@/lib/eccActivityStatuses": { getEccActivityStatuses: async () => status },
    "@/lib/eccActivityAdminActions": { applyEccActivityStatusAdminUpdate: async () => { throw Error("Must not change activity state"); } },
    "@/lib/eccGatheringDays": days, "@/lib/readOnlyDeveloper": readonly,
    "@/lib/eccGatheringSettings": { getEccGatheringSettings: async () => settingsResult, updateEccGatheringSettings: save },
    "@/lib/supabaseServer": { cleanText, SupabaseConfigError, SupabaseRequestError }
  });
}
const request = (body) => ({ json: async () => body });
test("only writable admins can configure days; invalid or mixed updates never write", async () => {
  let writes = 0;
  const save = async (selection) => { writes++; return { ...settingsResult, gatheringOpenDays: selection }; };
  for (const access of [{}, { isLoggedIn: true, email: "member@test" }, { isAdmin: true, isLoggedIn: true, email: "noritakeyuki@fuji.waseda.jp" }]) {
    assert.ok([401, 403].includes((await settingsRoute(access, save).PATCH(request({ gatheringOpenDays: ["monday"] }))).status));
  }
  const route = settingsRoute({ isAdmin: true, isLoggedIn: true, email: "admin@test" }, save);
  for (const body of [{ gatheringOpenDays: "monday" }, { gatheringOpenDays: ["friday"] }, { gatheringOpenDays: [], is_open: true }]) assert.equal((await route.PATCH(request(body))).status, 400);
  assert.equal(writes, 0);
  for (const value of [[], ["monday"], ["wednesday"], ["monday", "wednesday"]]) assert.equal((await route.PATCH(request({ gatheringOpenDays: value }))).status, 200);
  assert.equal(writes, 4);
});

function applicationHarness(options = {}) {
  const writes = [];
  const route = load("src/app/api/ecc/applications/route.ts", {
    "next/server": next, "@/lib/eccActivities": activities, "@/lib/eccGatheringDays": days,
    "@/lib/eccAccess": { getCurrentEccAccess: async () => options.access ?? { isLoggedIn: true, isOfficialMember: true, email: "member@test" } },
    "@/lib/eccActivityStatuses": { getEccActivityStatuses: async () => options.status ?? status },
    "@/lib/eccOperations": { getEccActivityCatalog: async () => catalog },
    "@/lib/eccGatheringSettings": {
      getEccGatheringSettings: async () => options.settings ?? settingsResult,
      isMissingGatheringColumn: settingsHarness(() => []).isMissingGatheringColumn
    },
    "@/lib/supabaseServer": { cleanText, SupabaseConfigError, SupabaseRequestError,
      supabaseRequest: async (path, init = {}) => {
        if (init.method === "POST") {
          writes.push(JSON.parse(init.body));
          if (options.insertError) throw options.insertError;
          return [];
        }
        return options.rows ?? [];
      }
    }
  });
  return { route, writes };
}
const form = { activity_id: "gathering", name: "Test", gender: "Etc", nationality: "Test", preferred_food: "Test" };

test("Gathering applications require one or both open days, preserving activity tracking", async () => {
  for (const selected of [["monday"], ["wednesday"], ["monday", "wednesday"]]) {
    const h = applicationHarness();
    assert.equal((await h.route.POST(request({ ...form, gathering_days: selected }))).status, 201);
    assert.deepEqual(h.writes[0].gathering_days, selected);
    assert.equal(h.writes[0].activity_instance_id, "instance-1");
    assert.equal(h.writes[0].user_id, "member@test");
  }
});

test("closed/stale days, empty choices, unavailable settings and nonmembers never insert", async () => {
  for (const options of [{ settings: { ...settingsResult, gatheringOpenDays: ["monday"] } }, { settings: { ...settingsResult, gatheringOpenDays: [] } }, { settings: { gatheringDaysReady: false, gatheringOpenDays: [] } }, { access: { isLoggedIn: true, isOfficialMember: false } }, { status: { ...status, statuses: { gathering: false } } }]) {
    const h = applicationHarness(options);
    assert.ok((await h.route.POST(request({ ...form, gathering_days: ["wednesday"] }))).status >= 400);
    assert.equal(h.writes.length, 0);
  }
  for (const value of [undefined, [], ["friday"], ["monday", "monday"]]) {
    const h = applicationHarness();
    assert.equal((await h.route.POST(request({ ...form, gathering_days: value }))).status, 400);
    assert.equal(h.writes.length, 0);
  }
});

test("DB close-race or missing weekday column is an error, never a lossy fallback insert", async () => {
  for (const error of [new SupabaseRequestError("ECC_GATHERING_DAYS_CLOSED"), new SupabaseRequestError("column gathering_days does not exist")]) {
    const h = applicationHarness({ insertError: error });
    assert.ok((await h.route.POST(request({ ...form, gathering_days: ["monday"] }))).status >= 400);
    assert.ok(h.writes.length >= 1);
    assert.ok(h.writes.every((row) => row.gathering_days?.[0] === "monday"));
  }
});

test("other activities retain their existing submission behavior; historic days remain empty", async () => {
  const h = applicationHarness();
  assert.equal((await h.route.POST(request({ ...form, activity_id: "mt" }))).status, 201);
  assert.equal("gathering_days" in h.writes[0], false);
  const admin = applicationHarness({ access: { isAdmin: true }, rows: [{ id: "old", activity_id: "gathering", name: "Earlier" }, { id: "new", activity_id: "gathering", name: "New", gathering_days: ["monday", "wednesday"] }] });
  const result = await admin.route.GET();
  assert.deepEqual(copy(result.body.applications[0].gatheringDays), []);
  assert.deepEqual(copy(result.body.applications[1].gatheringDays), ["monday", "wednesday"]);
});
