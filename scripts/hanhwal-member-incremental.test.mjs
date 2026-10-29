import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function load(file, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console: { error() {} }, Date, ...globals })(
    (name) => name in mocks ? mocks[name] : require(name), module, module.exports
  );
  return module.exports;
}

async function harness(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create table hanhwal_member_registrations(id text primary key, data jsonb); create table hanhwal_roles(id text primary key, data jsonb)");
  const state = { access: { isAdmin: true, isLoggedIn: true, email: "admin@example.test" }, calls: [], failRole: false, failRegistration: false, failRead: false };
  for (let n = 1; n <= 3; n++) {
    const paid = n !== 3;
    const row = { id: id(n), google_email: `member${n}@example.test`, google_name: `Member ${n}`, full_name: `Member ${n}`, student_id: `202600${n}`, payment_confirmed: paid, official_member: paid, status: paid ? "approved" : "submitted", admin_note: "", payment_confirmed_at: paid ? "2026-09-01T00:00:00Z" : null, payment_confirmed_by: paid ? "original@example.test" : null, official_member_approved_at: paid ? "2026-09-01T00:00:00Z" : null, official_member_approved_by: paid ? "original@example.test" : null, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
    await db.query("insert into hanhwal_member_registrations values ($1, $2)", [row.id, row]);
    const role = { id: `role${n}`, email: row.google_email, role: n === 2 ? "admin" : paid ? "official_member" : "user", admin_status: n === 2 ? "approved" : "none", is_official_member: paid, payment_confirmed: paid, official_member_status: paid ? "approved" : "none", payment_confirmed_at: row.payment_confirmed_at, payment_confirmed_by: row.payment_confirmed_by, created_at: row.created_at, updated_at: row.updated_at };
    await db.query("insert into hanhwal_roles values ($1, $2)", [role.id, role]);
  }
  const supabaseRequest = async (path, init = {}) => {
    const url = new URL(path, "https://isolated.test/");
    const table = url.pathname.slice(1);
    assert.ok(["hanhwal_member_registrations", "hanhwal_roles"].includes(table), "never touch ECC or production tables");
    const method = init.method || "GET";
    const payload = init.body ? JSON.parse(init.body) : null;
    state.calls.push({ table, method, path, payload });
    if (state.failRead && method === "GET" && table === "hanhwal_roles") throw new Error("role read failed");
    if (state.failRole && method !== "GET" && table === "hanhwal_roles") throw new Error("role write failed");
    if (state.failRegistration && method === "PATCH" && table === "hanhwal_member_registrations") throw new Error("registration write failed");
    const filterId = url.searchParams.get("id")?.slice(3);
    if (state.failRoleId === filterId && method === "PATCH" && table === "hanhwal_roles") throw new Error("selected role write failed");
    const email = url.searchParams.get("email")?.slice(3);
    const value = filterId || email;
    const where = filterId ? "id = $1" : email ? "data->>'email' = $1" : "true";
    if (method === "PATCH") {
      assert.ok(filterId, "all updates must target one registration or role");
      const result = await db.query(`update ${table} set data = data || $2::jsonb where ${where} returning data`, [value, payload]);
      return result.rows.map((row) => row.data);
    }
    assert.equal(method, "GET");
    const result = await db.query(`select data from ${table} where ${where}`, value ? [value] : []);
    return result.rows.map((row) => row.data);
  };
  const storage = { cleanText: (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "", supabaseRequest, SupabaseConfigError: class extends Error {}, SupabaseRequestError: class extends Error {} };
  const mocks = { "server-only": {}, "@/auth": { auth: async () => null }, "@/lib/admin": { normalizeEmail: (email) => (email || "").trim().toLowerCase(), getAdminAccess: async () => ({ isDeveloper: false }) }, "@/lib/supabaseServer": storage };
  const access = load("src/lib/hanhwalAccess.ts", mocks);
  mocks["@/lib/hanhwalAccess"] = { ...access, getCurrentHanhwalAccess: async () => state.access };
  const registrations = load("src/lib/hanhwalMemberRegistrations.ts", mocks);
  mocks["@/lib/hanhwalMemberRegistrations"] = registrations;
  mocks["@/lib/hanhwalMemberAdminActions"] = load("src/lib/hanhwalMemberAdminActions.ts", mocks);
  mocks["next/server"] = { NextResponse: { json: (body, options) => Response.json(body, options) } };
  const route = load("src/app/api/hanhwal/member-registrations/route.ts", mocks);
  return { db, state, route, registrations, patch: (updates, responseMode = "changes") => route.PATCH({ json: async () => ({ registrations: updates, responseMode }) }), rows: async (table = "hanhwal_member_registrations") => (await db.query(`select data from ${table} order by id`)).rows.map((row) => row.data) };
}
const writes = (h, table) => h.state.calls.filter((call) => call.method !== "GET" && (!table || call.table === table));

test("one new approval writes only that member, not previously approved members or their timestamps", async (t) => {
  const h = await harness(t);
  const before = await h.rows();
  const roleBefore = await h.rows("hanhwal_roles");
  const response = await h.patch([{ id: id(3), paymentConfirmed: true }]);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.updatedCount, 1);
  assert.equal(result.updatedRegistrations.length, 1);
  assert.equal(result.registrations, undefined);
  assert.equal(writes(h, "hanhwal_member_registrations").length, 1);
  assert.deepEqual((await h.rows()).slice(0, 2), before.slice(0, 2));
  assert.deepEqual((await h.rows("hanhwal_roles")).slice(0, 2), roleBefore.slice(0, 2));
  assert.ok(!h.state.calls.some((call) => call.table === "hanhwal_member_registrations" && !call.path.includes("id=eq.")));
});

test("unchanged legacy submissions and empty changes do zero writes", async (t) => {
  const h = await harness(t);
  const before = await h.rows();
  const response = await h.patch(before.map((row) => ({ id: row.id, paymentConfirmed: row.payment_confirmed, adminNote: row.admin_note })));
  assert.equal((await response.json()).updatedCount, 0);
  assert.equal(writes(h).length, 0);
  assert.equal(h.state.calls.some((call) => call.table === "hanhwal_roles"), false);
  assert.deepEqual(await h.rows(), before);
  assert.equal((await (await h.patch([])).json()).updatedCount, 0);
});

test("note-only updates preserve payment, approval history and roles; sparse status updates preserve current notes", async (t) => {
  const h = await harness(t);
  const before = (await h.rows())[0];
  assert.equal((await h.patch([{ id: id(1), adminNote: "  checked  " }])).status, 200);
  const after = (await h.rows())[0];
  assert.equal(after.admin_note, "checked");
  for (const key of ["payment_confirmed_at", "payment_confirmed_by", "official_member_approved_at", "official_member_approved_by", "status"]) assert.equal(after[key], before[key]);
  assert.equal(writes(h, "hanhwal_roles").length, 0);
  assert.deepEqual(Object.keys(writes(h)[0].payload).sort(), ["admin_note", "updated_at"]);
  await h.patch([{ id: id(1), paymentConfirmed: false }]);
  assert.equal((await h.rows())[0].admin_note, "checked");
});

test("permission failure leaves registration pending; identical retry succeeds without replaying unrelated members", async (t) => {
  const h = await harness(t);
  h.state.failRole = true;
  assert.equal((await h.patch([{ id: id(3), paymentConfirmed: true }])).status, 500);
  assert.equal((await h.rows())[2].payment_confirmed, false);
  assert.equal(writes(h, "hanhwal_member_registrations").length, 0);
  h.state.failRole = false;
  assert.equal((await h.patch([{ id: id(3), paymentConfirmed: true }])).status, 200);
  assert.equal((await h.rows())[2].official_member, true);
});

test("registration failure after role success is retryable without another role write", async (t) => {
  const h = await harness(t);
  h.state.failRegistration = true;
  assert.equal((await h.patch([{ id: id(3), paymentConfirmed: true }])).status, 500);
  const roleWrites = writes(h, "hanhwal_roles").length;
  assert.ok(roleWrites > 0);
  h.state.failRegistration = false;
  const result = await (await h.patch([{ id: id(3), paymentConfirmed: true }])).json();
  assert.equal(result.updatedCount, 1);
  assert.equal(writes(h, "hanhwal_roles").length, roleWrites);
});

test("partially completed batches retry only remaining writes and return already-saved rows for UI reconciliation", async (t) => {
  const h = await harness(t);
  const updates = [{ id: id(1), adminNote: "saved before interruption" }, { id: id(3), paymentConfirmed: true }];
  h.state.failRoleId = "role3";
  assert.equal((await h.patch(updates)).status, 500);
  assert.equal((await h.rows())[0].admin_note, "saved before interruption");
  h.state.failRoleId = "";
  h.state.calls = [];
  const result = await (await h.patch(updates)).json();
  assert.equal(result.updatedCount, 1);
  assert.deepEqual(result.updatedRegistrations.map((row) => row.id), [id(1), id(3)]);
  const registrationWrites = writes(h, "hanhwal_member_registrations");
  assert.equal(registrationWrites.length, 1);
  assert.ok(registrationWrites[0].path.includes(id(3)));
});

test("role lookup failure is not mistaken for a successful revocation and legacy responses remain compatible", async (t) => {
  const h = await harness(t);
  h.state.failRead = true;
  assert.equal((await h.patch([{ id: id(1), paymentConfirmed: false }])).status, 500);
  assert.equal(writes(h).length, 0);
  h.state.failRead = false;
  const result = await (await h.patch([{ id: id(1), adminNote: "legacy" }], "legacy")).json();
  assert.equal(result.registrations.length, 3);
  assert.equal(result.updatedCount, 1);
});

test("revoking payment does not downgrade an administrator; failures and unauthorized input never report success", async (t) => {
  const h = await harness(t);
  assert.equal((await h.patch([{ id: id(2), paymentConfirmed: false }])).status, 200);
  assert.equal((await h.rows("hanhwal_roles"))[1].admin_status, "approved");
  assert.equal((await h.rows("hanhwal_roles"))[1].role, "admin");
  h.state.calls = [];
  assert.equal((await h.patch([{ id: id(3), paymentConfirmed: "false" }])).status, 400);
  for (const isLoggedIn of [false, true]) {
    h.state.access = { isAdmin: false, isLoggedIn };
    assert.equal((await h.patch([{ id: id(3), paymentConfirmed: true }])).status, isLoggedIn ? 403 : 401);
  }
  assert.equal(writes(h).length, 0);
});

function componentHarness(h) {
  const cells = [];
  const requests = [];
  let cursor = 0;
  let mounted = false;
  const component = load("src/components/HanhwalMemberRegistrationManagementPanel.tsx", {
    react: { ...React, useState: (initial) => {
      const index = cursor++;
      if (!(index in cells)) cells[index] = initial;
      return [cells[index], (next) => { cells[index] = typeof next === "function" ? next(cells[index]) : next; }];
    }, useMemo: (fn) => fn(), useEffect: (fn) => { if (!mounted) { mounted = true; fn(); } } },
    "@/components/LanguageProvider": { useLanguage: () => ({ language: "ko" }), I18nText: ({ ko }) => ko },
    "@/components/MobileDisclosure": { MobileDisclosure: ({ children }) => children },
    "@/components/MemberRosterExportButton": { MemberRosterExportButton: () => null }
  }, { fetch: async (_url, init = {}) => {
    requests.push(init);
    return init.method === "PATCH" ? h.route.PATCH({ json: async () => JSON.parse(init.body) }) : h.route.GET();
  } });
  return { requests, render: () => { cursor = 0; return component.HanhwalMemberRegistrationManagementPanel(); } };
}
function elements(tree, type) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, type));
  return [...(tree.type === type ? [tree] : []), ...elements(tree.props?.children, type)];
}

test("top Save stays disabled without changes; UI sends one sparse record and does not re-fetch the full roster", async (t) => {
  const h = await harness(t);
  const ui = componentHarness(h);
  ui.render();
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  let tree = ui.render();
  assert.equal(elements(tree, "button").length, 1);
  let save = elements(tree, "button")[0];
  assert.equal(save.props.disabled, true);
  await save.props.onClick();
  assert.equal(ui.requests.length, 1);
  const html = renderToStaticMarkup(tree);
  assert.ok(html.indexOf("<button") < html.indexOf("<article"));
  const checkboxes = elements(tree, "input").filter((element) => element.props.type === "checkbox");
  checkboxes[2].props.onChange({ target: { checked: true } });
  save = elements(ui.render(), "button")[0];
  assert.equal(save.props.disabled, false);
  await save.props.onClick();
  assert.deepEqual(JSON.parse(ui.requests[1].body), { responseMode: "changes", registrations: [{ id: id(3), paymentConfirmed: true }] });
  tree = ui.render();
  assert.equal(elements(tree, "button")[0].props.disabled, true);
  assert.equal(elements(tree, "article").length, 3);
  assert.equal(ui.requests.length, 2);
  assert.match(renderToStaticMarkup(tree), /변경된 회원 정보 1건을 저장했습니다/);
});

test("UI preserves edits on save failure and note-only save never sends stale payment values", async (t) => {
  const h = await harness(t);
  const ui = componentHarness(h);
  ui.render();
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  elements(ui.render(), "textarea")[0].props.onChange({ target: { value: "note only" } });
  h.state.failRegistration = true;
  await elements(ui.render(), "button")[0].props.onClick();
  assert.equal(elements(ui.render(), "textarea")[0].props.value, "note only");
  assert.equal(elements(ui.render(), "button")[0].props.disabled, false);
  h.state.failRegistration = false;
  await elements(ui.render(), "button")[0].props.onClick();
  assert.deepEqual(JSON.parse(ui.requests.at(-1).body).registrations, [{ id: id(1), adminNote: "note only" }]);
  assert.equal(writes(h, "hanhwal_roles").length, 0);
});
