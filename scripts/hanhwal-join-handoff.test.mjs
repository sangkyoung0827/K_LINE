import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHanhwalJoinHarness, loadJoinModule } from "./lib/hanhwal-join-harness.mjs";

async function fixture(t, options) { const h = await createHanhwalJoinHarness(options); t.after(h.close); return h; }

test("a persisted submission enables the same team chat while official membership stays pending", async (t) => {
  const h = await fixture(t);
  const before = await (await h.call("registration")).json();
  assert.equal(before.teamChatPath, "");
  const submitted = await h.call("registration", "POST", { ...h.form, googleEmail: "another@example.test" });
  assert.equal(submitted.status, 201);
  const data = await submitted.json();
  assert.equal(data.teamChatPath, "/api/hanhwal/team-chat");
  assert.equal(data.registration.googleEmail, h.state.access.email);
  assert.equal(data.registration.officialMember, false);
  const opened = await h.call("teamChat");
  assert.equal(opened.status, 303);
  assert.equal(opened.headers.get("Location"), "https://example.test/hanhwal-first");
  assert.equal(opened.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await h.call("qr")).status, 403);
  const reopened = await (await h.call("registration")).json();
  assert.equal(reopened.registration.id, data.registration.id);
  assert.equal(reopened.teamChatPath, data.teamChatPath);
});

test("guests, users without applications and rejected applicants do not receive the invitation", async (t) => {
  const h = await fixture(t);
  h.state.access.isLoggedIn = false;
  assert.equal((await h.call("registration")).status, 401);
  assert.equal(new URL((await h.call("teamChat")).headers.get("Location")).pathname, "/login");
  h.state.access.isLoggedIn = true;
  assert.equal(new URL((await h.call("teamChat")).headers.get("Location")).pathname, "/hanhwal-join");
  await h.seedRegistration({ email: "another@example.test", approved: true });
  assert.equal((await (await h.call("registration")).json()).registration, null);
  await h.seedRegistration({ status: "rejected" });
  assert.equal((await (await h.call("registration")).json()).teamChatPath, "");
  assert.equal(new URL((await h.call("teamChat")).headers.get("Location")).pathname, "/hanhwal-join");
  assert.equal((await (await h.call("operations")).json()).settings.officialTeamChatUrl, "");
});

test("invalid or failed submissions never return a handoff or create a successful registration", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.call("registration", "POST", {})).status, 400);
  h.state.failSubmit = true;
  assert.equal((await h.call("registration", "POST", h.form)).status, 500);
  assert.equal((await (await h.call("registration")).json()).registration, null);
});

test("super admin edits update the shared period, bilingual descriptions and generated QR without member writes", async (t) => {
  const h = await fixture(t);
  await h.seedRegistration({ approved: true });
  h.state.access = { ...h.state.access, isOfficialMember: true, isAdmin: true, isSuperAdmin: true };
  const beforeMembers = await h.db.query("select * from hanhwal_member_registrations");
  const next = { officialTeamChatUrl: "https://example.test/hanhwal-next", periodLabel: "2027 Spring", teamChatDescriptionKo: "새 학기 안내\n등록한 이름으로 입장해 주세요.", teamChatDescriptionEn: "New semester\nPlease use your registered name." };
  assert.equal((await h.call("operations", "PATCH", next)).status, 200);
  const options = await (await h.call("registration")).json();
  assert.equal(options.periodLabel, next.periodLabel);
  assert.equal(options.teamChatDescriptionKo, next.teamChatDescriptionKo);
  assert.equal(options.teamChatDescriptionEn, next.teamChatDescriptionEn);
  assert.equal(options.canManageTeamChat, true);
  assert.equal((await h.call("teamChat")).headers.get("Location"), next.officialTeamChatUrl);
  const qr = await h.call("qr");
  const expected = await QRCode.toBuffer(next.officialTeamChatUrl, { errorCorrectionLevel: "M", margin: 2, type: "png", width: 720 });
  assert.deepEqual(Buffer.from(await qr.arrayBuffer()), expected);
  assert.equal(qr.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await h.db.query("select * from hanhwal_member_registrations"), beforeMembers);
  assert.equal((await h.call("registration", "POST", h.form)).status, 409);
});

test("ordinary members and read-only developers cannot edit; invalid URLs and unconfirmed writes fail", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.call("operations", "PATCH", { periodLabel: "changed" })).status, 403);
  h.state.access = { ...h.state.access, email: "readonly@example.test", isAdmin: true, isOfficialMember: true };
  assert.equal((await h.call("operations", "PATCH", {})).status, 403);
  h.state.access.email = "admin@example.test";
  for (const officialTeamChatUrl of ["javascript:alert(1)", "https://user:pass@example.test", "not a URL"]) {
    assert.equal((await h.call("operations", "PATCH", { officialTeamChatUrl })).status, 400);
  }
  h.state.emptySave = true;
  assert.equal((await h.call("operations", "PATCH", { periodLabel: "not persisted" })).status, 500);
});

test("migration is additive, repeatable and preserves existing links, audit fields and private RLS", async (t) => {
  const h = await fixture(t, { migrate: false });
  const before = await h.db.query("select * from hanhwal_operational_settings");
  const legacy = await h.operations.getHanhwalOperationalSettings();
  assert.equal(legacy.officialTeamChatUrl, before.rows[0].official_team_chat_url);
  assert.ok(legacy.teamChatDescriptionKo);
  await h.db.exec(h.migration);
  await h.db.exec(h.migration);
  const after = (await h.db.query("select * from hanhwal_operational_settings")).rows[0];
  for (const [key, value] of Object.entries(before.rows[0])) assert.deepEqual(after[key], value);
  assert.equal(typeof after.team_chat_description_ko, "string");
  assert.equal(typeof after.team_chat_description_en, "string");
  assert.equal((await h.db.query("select relrowsecurity from pg_class where oid='hanhwal_operational_settings'::regclass")).rows[0].relrowsecurity, true);
  await h.db.exec("create role anon; grant usage on schema public,auth to anon; grant select on hanhwal_operational_settings to anon; set role anon");
  assert.equal((await h.db.query("select * from hanhwal_operational_settings")).rows.length, 0);
});

test("settings outages keep saved applications readable and return failed handoffs to Join", async (t) => {
  const h = await fixture(t);
  await h.seedRegistration();
  h.state.failSettings = true;
  const response = await h.call("registration");
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.registration);
  assert.equal(data.teamChatUnavailable, true);
  assert.equal(data.teamChatPath, "");
  assert.equal(new URL((await h.call("teamChat")).headers.get("Location")).pathname, "/hanhwal-join");
});

function joinComponent(h) {
  const cells = [], effects = [], pending = [], navigations = [], requests = [];
  const listeners = new Map();
  let cursor = 0;
  const component = loadJoinModule("src/components/HanhwalMemberRegistrationForm.tsx", {
    react: { ...React,
      useState: (initial) => { const index = cursor++; if (!(index in cells)) cells[index] = initial; return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }]; },
      useRef: (initial) => { const index = cursor++; return cells[index] ??= { current: initial }; },
      useMemo: (fn) => fn(),
      useEffect: (fn, deps) => { const index = cursor++; if (!effects[index] || deps.some((value, i) => !Object.is(value, effects[index][i]))) { effects[index] = deps; pending.push(fn); } }
    },
    "next/navigation": { usePathname: () => "/hanhwal-join" },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/components/LanguageProvider": { useLanguage: () => ({ language: "ko" }), I18nText: ({ ko }) => ko },
    "./HanhwalJoinForm.module.css": { default: new Proxy({}, { get: (_, key) => String(key) }) }
  }, {
    window: { location: { assign: (path) => { assert.ok(h.state.calls.some((call) => call.method === "POST" && call.path.startsWith("hanhwal_member_registrations")), "navigate only after a confirmed registration write"); navigations.push(path); } }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
    fetch: async (_url, init = {}) => { requests.push(init); return h.call("registration", init.method || "GET", init.body ? JSON.parse(init.body) : {}); }
  });
  return { requests, navigations, listeners, render: () => {
    cursor = 0;
    const tree = component.HanhwalMemberRegistrationForm({ variant: "site", intro: React.createElement("div", { "data-new-member-intro": true }, "Membership fees") });
    while (pending.length) pending.shift()();
    return tree;
  } };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate));
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
}
const tick = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function fill(ui, form) {
  const labels = { "Full Name / 이름": "fullName", "Student ID / 학번": "studentId", "Department or Major / 학과 또는 전공": "departmentOrMajor", "Nationality / 국적": "nationality", "KakaoTalk Display Name / 카카오톡 표시 이름": "kakaoDisplayName", "Kakao ID / 카카오톡 ID": "kakaoId" };
  for (const field of nodes(ui.render(), (node) => node.type?.name === "TextField")) field.props.onChange(form[labels[field.props.label]]);
  nodes(ui.render(), (node) => node.type === "input" && node.props.type === "radio" && node.props.value === form.gender)[0].props.onChange({ target: { value: form.gender } });
}

test("Join UI navigates once after persistence, never on revisit, and pending membership is not upgraded", async (t) => {
  const h = await fixture(t);
  const ui = joinComponent(h); ui.render(); await tick();
  fill(ui, h.form);
  await nodes(ui.render(), (node) => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.deepEqual(ui.navigations, ["/api/hanhwal/team-chat"]);
  assert.equal((await (await h.call("registration")).json()).registration.officialMember, false);
  const revisit = joinComponent(h); revisit.render(); await tick();
  const tree = revisit.render();
  assert.equal(revisit.navigations.length, 0);
  assert.equal(nodes(tree, (node) => node.type === "details")[0].props.open, undefined);
  assert.equal(nodes(tree, (node) => node.props?.href === "/hanhwal-official").length, 0);
  assert.ok(nodes(tree, (node) => node.props?.href === "/api/hanhwal/team-chat").length);
});

test("failed submissions retain typed data and do not navigate", async (t) => {
  const h = await fixture(t);
  const ui = joinComponent(h); ui.render(); await tick(); fill(ui, h.form);
  h.state.failSubmit = true;
  await nodes(ui.render(), (node) => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(ui.navigations.length, 0);
  assert.equal(nodes(ui.render(), (node) => node.type?.name === "TextField" && node.props.label === "Full Name / 이름")[0].props.value, h.form.fullName);
});

test("approval refresh reveals official links without another redirect, while submitted details remain collapsed", async (t) => {
  const h = await fixture(t); const row = await h.seedRegistration();
  const ui = joinComponent(h); ui.render(); await tick(); ui.render();
  await h.db.query("update hanhwal_member_registrations set data=data || $2::jsonb where id=$1", [row.id, { official_member: true, payment_confirmed: true, status: "approved" }]);
  h.state.access.isOfficialMember = true;
  ui.listeners.get("focus")(); await tick();
  const tree = ui.render(); const html = renderToStaticMarkup(tree);
  assert.ok(nodes(tree, (node) => node.props?.href === "/hanhwal-official").length);
  assert.ok(nodes(tree, (node) => node.props?.href === "/api/hanhwal/team-chat").length);
  assert.equal(nodes(tree, (node) => node.type === "details")[0].props.open, undefined);
  assert.doesNotMatch(html, /data-new-member-intro/);
  assert.equal(ui.navigations.length, 0);
});

test("background status refresh does not replace a pending applicant's active edits", async (t) => {
  const h = await fixture(t); await h.seedRegistration();
  const ui = joinComponent(h); ui.render(); await tick();
  nodes(ui.render(), (node) => node.type === "button" && renderToStaticMarkup(node).includes("등록 정보 수정"))[0].props.onClick();
  fill(ui, { ...h.form, fullName: "Unsaved local change" }); ui.render();
  const count = ui.requests.length;
  ui.listeners.get("focus")(); await tick();
  assert.equal(ui.requests.length, count);
  assert.equal(nodes(ui.render(), (node) => node.type?.name === "TextField" && node.props.label === "Full Name / 이름")[0].props.value, "Unsaved local change");
});

test("already-appointed super admins without a registration get official/chat/settings links, not another application form", async (t) => {
  const h = await fixture(t);
  h.state.access = { ...h.state.access, isOfficialMember: true, isAdmin: true, isSuperAdmin: true };
  const ui = joinComponent(h); ui.render(); await tick();
  const tree = ui.render();
  assert.equal(nodes(tree, (node) => node.type === "form").length, 0);
  for (const href of ["/hanhwal-official", "/api/hanhwal/team-chat", "/our-activities/hanhwal/operations"]) assert.equal(nodes(tree, (node) => node.props?.href === href).length, 1);
  assert.match(renderToStaticMarkup(tree), /제출된 가입 신청서는 없습니다/);
  assert.equal(ui.navigations.length, 0);
});
