import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  cleanHanhwalStructuredActivityInput,
  cleanHanhwalStructuredSubmissionPayload,
  HanhwalStructuredError
} from "./hanhwalStructuredValidation";
import type { HanhwalStructuredActivity } from "./hanhwalStructuredTypes";
import { summarizeHanhwalStructuredActivity } from "./hanhwalStructuredSummary";

const future = new Date(Date.now() + 86_400_000).toISOString();
const base = (kind: "competition" | "equipment_order" | "uniform_order", configuration: object) => ({
  kind, title: "Autumn round", eventDate: future, location: "Range", itemName: "Configured item",
  deadline: future, status: "open", configuration
});
const activity = (kind: HanhwalStructuredActivity["kind"], configuration: HanhwalStructuredActivity["configuration"]): HanhwalStructuredActivity => ({
  id: "00000000-0000-0000-0000-000000000001", kind, title: "Round", description: "",
  eventDate: "", location: "", deadline: future, feeKrw: null, unitPriceKrw: null,
  pricingNote: "", itemName: "", pickupInformation: "", notes: "", status: "open",
  configuration, createdAt: future, updatedAt: future
});
const errorCode = (fn: () => unknown) => {
  try { fn(); return ""; } catch (error) { return error instanceof HanhwalStructuredError ? error.code : "UNKNOWN"; }
};

test("the three additive kinds are accepted", () => {
  assert.equal(cleanHanhwalStructuredActivityInput(base("competition", { divisions: [{ label: "University" }] })).kind, "competition");
  assert.equal(cleanHanhwalStructuredActivityInput(base("equipment_order", { itemType: "arrow" })).kind, "equipment_order");
  assert.equal(cleanHanhwalStructuredActivityInput(base("uniform_order", { sizes: ["M"] })).kind, "uniform_order");
});
test("unknown structured kind is rejected", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [] }), kind: "gathering" })), "INVALID_KIND"));
test("an existing round cannot change its structured kind", () => {
  const existing = activity("competition", { divisions: [{ id: "a", label: "A", description: "", capacity: null }] });
  assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("uniform_order", { sizes: ["M"] }) }, existing)), "KIND_IMMUTABLE");
});
test("title is required", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [{ label: "A" }] }), title: "" })), "TITLE_REQUIRED"));
test("deadline is required", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [{ label: "A" }] }), deadline: "" })), "INVALID_DATE"));
test("open rounds reject elapsed deadlines", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [{ label: "A" }] }), deadline: "2020-01-01" })), "DEADLINE_PASSED"));
test("draft rounds may preserve elapsed deadlines", () => assert.equal(cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [] }), deadline: "2020-01-01", status: "draft" }).status, "draft"));
test("open competition requires a division", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput(base("competition", { divisions: [] }))), "DIVISIONS_REQUIRED"));
test("division IDs are normalized and deduplicated", () => {
  const row = cleanHanhwalStructuredActivityInput(base("competition", { divisions: [{ label: "대학부" }, { label: "대학부" }] }));
  const ids = (row.configuration as { divisions: Array<{ id: string }> }).divisions.map((entry) => entry.id);
  assert.equal(new Set(ids).size, 2);
});
test("optional division capacity must be positive", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput(base("competition", { divisions: [{ label: "A", capacity: 0 }] }))), "INVALID_QUANTITY_RULE"));
test("money must be a non-negative whole number", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput({ ...base("competition", { divisions: [{ label: "A" }] }), feeKrw: -1 })), "INVALID_AMOUNT"));
test("historical prices are never defaulted", () => {
  const row = cleanHanhwalStructuredActivityInput(base("equipment_order", { itemType: "arrow" }));
  assert.equal(row.feeKrw, null); assert.equal(row.unitPriceKrw, null);
});
for (const itemType of ["bow", "arrow", "bow_and_arrow", "other"] as const) {
  test(`equipment item type ${itemType} is accepted`, () => assert.equal((cleanHanhwalStructuredActivityInput(base("equipment_order", { itemType })).configuration as { itemType: string }).itemType, itemType));
}
test("unsupported equipment item type is rejected", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput(base("equipment_order", { itemType: "sword" }))), "INVALID_ITEM_TYPE"));
test("open uniform order requires sizes", () => assert.equal(errorCode(() => cleanHanhwalStructuredActivityInput(base("uniform_order", { sizes: [] }))), "SIZES_REQUIRED"));
test("option lists are trimmed and deduplicated", () => {
  const row = cleanHanhwalStructuredActivityInput(base("uniform_order", { sizes: [" M ", "M", "L"] }));
  assert.deepEqual((row.configuration as { sizes: string[] }).sizes, ["M", "L"]);
});
test("competition submission requires a configured division", () => {
  const a = activity("competition", { divisions: [{ id: "university", label: "University", description: "", capacity: null }] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { divisionId: "other" })), "INVALID_DIVISION");
});
test("competition submission keeps only division and note", () => {
  const a = activity("competition", { divisions: [{ id: "university", label: "University", description: "", capacity: null }] });
  assert.deepEqual(cleanHanhwalStructuredSubmissionPayload(a, { divisionId: "university", note: "Ready", attendance: true }), { divisionId: "university", note: "Ready" });
});
test("order quantity must be positive", () => {
  const a = activity("equipment_order", { itemType: "arrow", minimumOrderUnit: null, availableOptions: [], featherColors: [], lengths: [], weights: [] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 0 })), "INVALID_QUANTITY");
});
test("equipment minimum order unit is enforced", () => {
  const a = activity("equipment_order", { itemType: "arrow", minimumOrderUnit: 5, availableOptions: [], featherColors: [], lengths: [], weights: [] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 3 })), "INVALID_ORDER_UNIT");
});
test("equipment configured option is enforced", () => {
  const a = activity("equipment_order", { itemType: "arrow", minimumOrderUnit: null, availableOptions: ["carbon"], featherColors: [], lengths: [], weights: [] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 1, option: "wood" })), "INVALID_EQUIPMENT_OPTION");
});
test("equipment configurable color, length and weight are enforced", () => {
  const a = activity("equipment_order", { itemType: "arrow", minimumOrderUnit: null, availableOptions: [], featherColors: ["red"], lengths: ["30"], weights: ["60"] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 1, featherColor1: "blue" })), "INVALID_FEATHER_COLOR");
});
test("uniform size and variant are enforced", () => {
  const a = activity("uniform_order", { sizes: ["M"], variants: ["black"] });
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 1, size: "L", variant: "black" })), "INVALID_SIZE");
  assert.equal(errorCode(() => cleanHanhwalStructuredSubmissionPayload(a, { quantity: 1, size: "M", variant: "white" })), "INVALID_VARIANT");
});
test("uniform valid payload contains no identity or attendance fields", () => {
  const a = activity("uniform_order", { sizes: ["M"], variants: [] });
  assert.deepEqual(cleanHanhwalStructuredSubmissionPayload(a, { quantity: 2, size: "M", email: "victim@test", attended: true }), { quantity: 2, size: "M", variant: "", note: "" });
});
test("competition aggregation counts configured divisions and ignores cancelled rows", () => {
  const a = activity("competition", { divisions: [{ id: "a", label: "A", description: "", capacity: 2 }] });
  const rows = [
    { id: "1", activityId: a.id, kind: "competition" as const, userName: "A", payload: { divisionId: "a", note: "" }, status: "submitted" as const, paymentStatus: "unconfirmed" as const, fulfillmentStatus: null, appliedAt: future, updatedAt: future },
    { id: "2", activityId: a.id, kind: "competition" as const, userName: "B", payload: { divisionId: "a", note: "" }, status: "cancelled" as const, paymentStatus: "unconfirmed" as const, fulfillmentStatus: null, appliedAt: future, updatedAt: future }
  ];
  const summary = summarizeHanhwalStructuredActivity(a, rows);
  assert.equal(summary.submissionCount, 1); assert.equal(summary.breakdown[0].count, 1); assert.equal(summary.breakdown[0].capacity, 2);
});
test("equipment aggregation calculates option quantity and configured total", () => {
  const a = { ...activity("equipment_order", { itemType: "arrow", minimumOrderUnit: null, availableOptions: ["carbon"], featherColors: [], lengths: [], weights: [] }), unitPriceKrw: 7000 };
  const rows = [{ id: "1", activityId: a.id, kind: "equipment_order" as const, userName: "A", payload: { quantity: 3, option: "carbon", printText: "", featherColor1: "", featherColor2: "", length: "", weight: "", note: "" }, status: "submitted" as const, paymentStatus: "confirmed" as const, fulfillmentStatus: "ordered" as const, appliedAt: future, updatedAt: future }];
  const summary = summarizeHanhwalStructuredActivity(a, rows);
  assert.equal(summary.totalQuantity, 3); assert.equal(summary.breakdown[0].count, 3); assert.equal(summary.estimatedTotalKrw, 21000);
});
test("uniform aggregation reports size and variant quantities", () => {
  const a = activity("uniform_order", { sizes: ["M"], variants: ["black"] });
  const rows = [{ id: "1", activityId: a.id, kind: "uniform_order" as const, userName: "A", payload: { quantity: 2, size: "M", variant: "black", note: "" }, status: "submitted" as const, paymentStatus: "unconfirmed" as const, fulfillmentStatus: "ready" as const, appliedAt: future, updatedAt: future }];
  const summary = summarizeHanhwalStructuredActivity(a, rows);
  assert.equal(summary.breakdown.find((row) => row.id === "size:M")?.count, 2);
  assert.equal(summary.breakdown.find((row) => row.id === "variant:black")?.count, 2);
});
test("routes require official membership and admin writes", () => {
  const activitiesRoute = readFileSync("src/app/api/hanhwal/structured-activities/route.ts", "utf8");
  const submissionsRoute = readFileSync("src/app/api/hanhwal/structured-submissions/route.ts", "utf8");
  assert.match(activitiesRoute, /!access\.isOfficialMember/);
  assert.match(activitiesRoute, /!access\.isAdmin/g);
  assert.match(submissionsRoute, /!access\.isOfficialMember/g);
  assert.match(activitiesRoute + submissionsRoute, /isReadOnlyDeveloperEmail/);
  assert.doesNotMatch(activitiesRoute + submissionsRoute, /export async function DELETE/);
});
test("only competition schedules a preference signal", () => {
  const server = readFileSync("src/lib/hanhwalStructuredServer.ts", "utf8");
  assert.match(server, /activity\.kind === "competition"[\s\S]*scheduleApplicationPreference\("hanhwal"/);
  assert.doesNotMatch(server, /scheduleApplicationPreference\("hanhwal"[^]*activity_id: "(?:equipment_order|uniform_order)"/);
});
test("migration is additive, rerunnable, private and preserves history", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table existing_hanhwal_sentinel(id int primary key, value text); insert into existing_hanhwal_sentinel values(1,'untouched');");
    const sql = readFileSync("supabase/hanhwal_structured_applications.sql", "utf8");
    await db.exec(sql); await db.exec(sql);
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('hanhwal_structured_activities','hanhwal_structured_submissions') order by relname");
    assert.equal(tables.rows.length, 2); assert.ok(tables.rows.every((row) => row.relrowsecurity));
    assert.deepEqual((await db.query("select * from existing_hanhwal_sentinel")).rows, [{ id: 1, value: "untouched" }]);
    await db.exec(`insert into hanhwal_structured_activities
      (id,kind,title,deadline,status,configuration,created_by,updated_by)
      values ('00000000-0000-0000-0000-000000000010','competition','Test','2099-01-01','open',
      '{"divisions":[{"id":"a","label":"A","capacity":1}]}','admin@test','admin@test');
      insert into hanhwal_structured_submissions
      (activity_id,kind,user_email,user_name,payload,updated_by)
      values ('00000000-0000-0000-0000-000000000010','competition','one@test','One','{"divisionId":"a"}','one@test');`);
    await assert.rejects(db.exec(`insert into hanhwal_structured_submissions
      (activity_id,kind,user_email,user_name,payload,updated_by)
      values ('00000000-0000-0000-0000-000000000010','competition','two@test','Two','{"divisionId":"a"}','two@test')`), /HANHWAL_DIVISION_FULL/);
    await assert.rejects(db.exec(`insert into hanhwal_structured_submissions
      (activity_id,kind,user_email,user_name,payload,updated_by)
      values ('00000000-0000-0000-0000-000000000010','uniform_order','wrong@test','Wrong','{}','wrong@test')`), /HANHWAL_KIND_MISMATCH/);
    await assert.rejects(db.exec("delete from hanhwal_structured_activities where id='00000000-0000-0000-0000-000000000010'"), /foreign key/);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from hanhwal_structured_activities"), /permission denied/);
  } finally { await db.close(); }
});
test("migration has no seeded operational rounds or historical order values", () => {
  const sql = readFileSync("supabase/hanhwal_structured_applications.sql", "utf8");
  assert.doesNotMatch(sql, /15000|12000|145cm|60g|30inch/i);
  assert.doesNotMatch(sql, /insert into public\.hanhwal_structured_activities/i);
});
test("legacy six activity types and board endpoints remain in source", () => {
  const legacy = readFileSync("src/lib/hanhwalActivities.ts", "utf8");
  for (const kind of ["gathering", "mt", "special", "opening", "farewell", "english-class"]) assert.match(legacy, new RegExp(`"${kind}"`));
  assert.ok(readFileSync("src/app/api/hanhwal/applications/route.ts", "utf8").length > 1000);
  assert.ok(readFileSync("src/app/api/hanhwal/posts/route.ts", "utf8").length > 1000);
});
