import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { readSheet as readXlsxFile } from "read-excel-file/node";

const require = createRequire(import.meta.url);
function load(path, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Response, Uint8Array, Date, console, ...globals })((name) => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/lib/")) return load(`src/${name.slice(2)}.ts`, mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

function harness() {
  const control = { ecc: { isAdmin: true, isLoggedIn: true }, hanhwal: { isAdmin: true, isLoggedIn: true }, fail: false, calls: [], cap: 500, repeat: false };
  const tables = {
    ecc_member_registrations: Array.from({ length: 1201 }, (_, index) => ({ id: `${index}`.padStart(8, "0"), student_id: `${1201 - index}`.padStart(9, "0"), full_name: `ECC ${index}`, payment_confirmed: index % 2 === 0 })),
    hanhwal_member_registrations: [{ id: "00000001", student_id: "00012", full_name: "한활 회원", official_member: true }]
  };
  const mocks = {
    "@/lib/eccAccess": { getCurrentEccAccess: async () => control.ecc },
    "@/lib/hanhwalAccess": { getCurrentHanhwalAccess: async () => control.hanhwal },
    "@/lib/eccMemberRegistrations": { eccMemberRegistrationsTable: "ecc_member_registrations" },
    "@/lib/hanhwalMemberRegistrations": { hanhwalMemberRegistrationsTable: "hanhwal_member_registrations" },
    "@/lib/supabaseServer": { supabaseRequest: async (path, init = {}) => {
      control.calls.push({ path, init });
      if (control.fail) throw Error("secret database details");
      const url = new URL(path, "http://local.test/");
      const table = tables[url.pathname.slice(1)];
      const cursor = url.searchParams.get("id")?.slice(3);
      return table.filter((row) => control.repeat || !cursor || row.id > cursor).slice(0, control.cap).map(({ id, student_id, full_name }) => ({ id, student_id, full_name }));
    } }
  };
  return { control, tables, api: Object.fromEntries(["ecc", "hanhwal"].map((club) => [club, load(`src/app/api/${club}/member-registrations/export/route.ts`, mocks)])) };
}

test("each route denies guest, ordinary member or other-club admin before reading", async () => {
  for (const club of ["ecc", "hanhwal"]) {
    const h = harness();
    for (const isLoggedIn of [false, true]) {
      h.control[club] = { isAdmin: false, isLoggedIn };
      const response = await h.api[club].GET();
      assert.equal(response.status, isLoggedIn ? 403 : 401);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal(h.control.calls.length, 0);
    }
  }
});

test("club exports are complete beyond 1,000 rows, with no unrelated/private fields or writes", async () => {
  const h = harness(); h.control.cap = 137;
  const before = JSON.stringify(h.tables);
  for (const club of ["ecc", "hanhwal"]) {
    const response = await h.api[club].GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type"), /spreadsheetml.sheet/);
    assert.match(response.headers.get("Content-Disposition"), new RegExp(`${club}-members-.*\\.xlsx`));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const rows = await readXlsxFile(Buffer.from(await response.arrayBuffer()));
    assert.equal(rows.length, h.tables[`${club}_member_registrations`].length + 1);
    assert.deepEqual(rows[0], ["학번", "이름"]);
    assert.equal(rows[1][0], club === "ecc" ? "000000001" : "00012");
    assert.ok(rows.slice(1).every((row) => row.length === 2 && row[1].startsWith(club === "ecc" ? "ECC" : "한활")));
  }
  assert.equal(JSON.stringify(h.tables), before);
  for (const { path, init } of h.control.calls) {
    assert.equal(init.method ?? "GET", "GET");
    assert.equal(new URL(path, "http://local.test").searchParams.get("select"), "id,student_id,full_name");
    assert.doesNotMatch(path, /site_members|payment|official|google_email/);
  }
});

test("storage errors and stuck pagination fail without disclosing details or returning partial files", async () => {
  for (const failure of ["fail", "repeat"]) {
    const h = harness(); h.control[failure] = true;
    const response = await h.api.ecc.GET();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /secret database/);
    assert.ok(h.control.calls.length <= 2);
  }
});

function buttonHarness(fetch) {
  const state = { loading: false, error: "", clicks: 0, requests: [] };
  let index = 0;
  const ref = { current: false };
  const component = load("src/components/MemberRosterExportButton.tsx", {
    react: { ...require("react"), useRef: () => ref, useState: () => {
      const field = index++ === 0 ? "loading" : "error";
      return [state[field], (value) => { state[field] = value; }];
    } },
    "@/components/LanguageProvider": { useLanguage: () => ({ language: "ko" }), I18nText: ({ ko }) => ko }
  }, {
    fetch: async (...args) => { state.requests.push(args); return fetch(...args); },
    URL: { createObjectURL: () => "blob:local", revokeObjectURL: () => {} },
    window: { setTimeout: () => {} },
    document: { createElement: () => ({ click: () => { state.clicks++; }, remove: () => {} }), body: { appendChild: () => {} } }
  });
  const tree = component.MemberRosterExportButton({ club: "hanhwal" });
  return { state, click: tree.props.children[0].props.onClick };
}

test("export button reports authorization/network/HTML errors and never downloads an error page", async () => {
  for (const fetch of [
    async () => Response.json({ error: "denied" }, { status: 401 }),
    async () => Response.json({ error: "denied" }, { status: 403 }),
    async () => Response.json({ error: "offline" }, { status: 503 }),
    async () => new Response("login page", { headers: { "Content-Type": "text/html" } }),
    async () => { throw Error("offline"); }
  ]) {
    const h = buttonHarness(fetch); await h.click();
    assert.equal(h.state.clicks, 0); assert.equal(h.state.loading, false);
    assert.match(h.state.error, /다운로드하지 못했습니다/);
    assert.equal(h.state.requests[0][0], "/api/hanhwal/member-registrations/export");
    assert.equal(h.state.requests[0][1].cache, "no-store");
  }
});

test("rapid double click issues only one GET/download and never saves fee/approval changes", async () => {
  let finish;
  const h = buttonHarness(() => new Promise((resolve) => { finish = resolve; }));
  const first = h.click(); await h.click();
  assert.equal(h.state.requests.length, 1); assert.equal(h.state.loading, true);
  finish(new Response("xlsx", { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }));
  await first;
  assert.equal(h.state.clicks, 1); assert.equal(h.state.loading, false); assert.equal(h.state.error, "");
  assert.equal(h.state.requests[0][1].method, undefined);
});
