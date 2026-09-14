import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { URL, URLSearchParams, AbortController, AbortSignal, Buffer, console: { error() {} }, ...globals })((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/lib/my")) return load(`src/${name.slice(2)}.ts`, mocks, globals);
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const owner = "member@example.test";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const rawRow = (n, date = "2026-09-10T04:45:30.123456+00:00") => ({ id: id(n), source: n % 2 ? "ecc" : "hanhwal", activity_title_snapshot: `Activity ${n}`, activity_date_snapshot: date, rating: null });
const cursor = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function route({ email = owner, read = async () => [] } = {}) {
  return load("src/app/api/activity-history/timeline/route.ts", {
    "@/auth": { auth: async () => ({ user: { email } }) },
    "@/lib/admin": { normalizeEmail: (email) => email?.trim().toLowerCase() || "" },
    "@/lib/supabaseServer": { supabaseRequest: read }
  }).GET;
}

test("history is session-only, uncached, GET-only and cannot select another user's records", async () => {
  const calls = [];
  const get = route({ read: async (path, init) => { calls.push({ path, init }); return [rawRow(1)]; } });
  const response = await get(new Request("https://example.test/api/activity-history/timeline?email=other@test&user_id=other@test&limit=999999"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  const body = await response.json();
  assert.equal(body.ownerEmail, owner);
  assert.equal(body.records[0].closedAt, rawRow(1).activity_date_snapshot);
  assert.equal(body.records[0].activityTitle, "Activity 1");
  assert.equal(calls.length, 1);
  const query = new URLSearchParams(calls[0].path.split("?")[1]);
  assert.equal(query.get("user_id"), `eq.${owner}`);
  assert.equal(query.get("limit"), "51");
  assert.equal(query.get("order"), "activity_date_snapshot.desc.nullslast,id.desc");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.cache, "no-store");
  assert.ok(calls[0].init.signal);
  assert.equal(calls[0].init.body, undefined);
});

test("anonymous access never queries the database and store errors are not an empty history", async () => {
  const guest = await route({ email: null, read: async () => { throw new Error("Must not query"); } })(new Request("https://example.test"));
  assert.equal(guest.status, 401);
  const failure = await route({ read: async () => { throw new Error("Private DB details"); } })(new Request("https://example.test"));
  assert.equal(failure.status, 503);
  assert.doesNotMatch(await failure.text(), /Private DB details|records/);
  assert.equal((await route()(new Request("https://example.test"))).status, 200);
});

test("keyset pagination preserves tied timestamps including microseconds and is not capped at 500", async () => {
  const rows = Array.from({ length: 51 }, (_, n) => rawRow(600 - n));
  const first = await (await route({ read: async () => rows })(new Request("https://example.test"))).json();
  assert.equal(first.records.length, 50);
  assert.equal(first.records[0].id, id(600));
  const decoded = JSON.parse(Buffer.from(first.nextCursor, "base64url"));
  assert.equal(decoded.id, id(551));
  assert.equal(decoded.date, rows[49].activity_date_snapshot);
  let query;
  const second = await (await route({ read: async (path) => { query = new URLSearchParams(path.split("?")[1]); return [rows[50]]; } })(new Request(`https://example.test?cursor=${first.nextCursor}`))).json();
  assert.match(query.get("or"), /\.123456\+00:00/);
  assert.ok(query.get("or").includes(`id.lt.${id(551)}`));
  assert.ok(query.get("or").includes("activity_date_snapshot.is.null"));
  assert.equal(second.records[0].id, id(550));
  assert.equal(second.nextCursor, null);
  assert.equal(query.get("offset"), null);
});

test("undated records paginate last without fake dates or dropping other clubs", async () => {
  let query;
  const response = await route({ read: async (path) => { query = new URLSearchParams(path.split("?")[1]); return [rawRow(1, null), rawRow(2, null)]; } })(new Request(`https://example.test?cursor=${cursor({ date: null, id: id(3) })}`));
  assert.equal(query.get("activity_date_snapshot"), "is.null");
  assert.equal(query.get("id"), `lt.${id(3)}`);
  const data = await response.json();
  assert.deepEqual(data.records.map((record) => record.source), ["ecc", "hanhwal"]);
  assert.ok(data.records.every((record) => record.closedAt === null));
});

test("malformed/injected cursors fail before any database access", async () => {
  const bad = ["", "?invalid", cursor(null), cursor({ id: "or.user_id.neq.x", date: null }), cursor({ id: id(1), date: "2026-09-10T04:45:30Z,source.neq.ecc" }), cursor({ id: id(1), date: "not-a-date" }), "a".repeat(600)];
  for (const value of bad) {
    let called = false;
    const response = await route({ read: async () => { called = true; return []; } })(new Request(`https://example.test?cursor=${encodeURIComponent(value)}`));
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

const language = (lang) => ({ useLanguage: () => ({ language: lang }) });
const link = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };

test("My clubs exposes history even while membership is loading/failed or no club is joined", () => {
  const { MyClubsSheet } = load("src/components/MyClubsSheet.tsx", {
    "@/components/LanguageProvider": language("ko"), "next/link": link,
    "@/components/ClubMark": { ClubMark: () => null }
  });
  for (const sessionStatus of ["loading", "authenticated", "unauthenticated"]) {
    const html = renderToStaticMarkup(React.createElement(MyClubsSheet, { sessionStatus, ownerEmail: owner, returnTo: "/", onClose() {} }));
    assert.match(html, /href="\/my-history"/);
    assert.match(html, /My history/);
  }
  const bottom = readFileSync("src/components/MobileBottomNav.tsx", "utf8");
  assert.match(bottom, /pathname === "\/my-history"/);
  const page = readFileSync("src/app/my-history/page.tsx", "utf8");
  assert.match(page, /createNoIndexMetadata/);
  assert.match(page, /if \(!\(await auth\(\)\)\?\.user\?\.email\) redirect/);
});

test("timeline shows mixed clubs in supplied order, clear closure dates, stars and pagination", () => {
  let index = 0;
  const sample = [{ id: id(2), source: "hanhwal", activityTitle: "한활 체험", closedAt: "2026-09-14T16:00:00Z", rating: 5 }, { id: id(1), source: "ecc", activityTitle: "International Gathering", closedAt: null, rating: null }];
  const { HistoryRecords } = load("src/components/MyHistory.tsx", {
    "@/components/LanguageProvider": language("ko"), "next/link": link,
    "next-auth/react": { useSession: () => ({ status: "authenticated" }) },
    react: { ...React, useEffect() {}, useRef: () => ({ current: false }), useState: (initial) => [[sample, "next", initial, false, false, false][index++], () => {}] }
  });
  const html = renderToStaticMarkup(React.createElement(HistoryRecords, { ownerEmail: owner }));
  assert.ok(html.indexOf("한활 체험") < html.indexOf("International Gathering"));
  assert.match(html, /신청 마감/);
  assert.match(html, /15/);
  assert.match(html, /날짜 미상/);
  assert.match(html, /내 별점: 5\/5/);
  assert.match(html, /더 보기/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.doesNotMatch(html, /출석 확인|참석 완료|confirmed attendance/);
});

test("history deduplicates pagination and formats Korean dates without inventing missing dates", () => {
  const { appendHistory, historyDate } = load("src/lib/myHistory.ts");
  assert.deepEqual(Array.from(appendHistory([{ id: "a" }], [{ id: "a" }, { id: "b" }, { id: "b" }]), (row) => row.id), ["a", "b"]);
  assert.match(historyDate("2026-09-14T16:00:00Z", "en"), /15 Sept 2026/);
  assert.equal(historyDate(null, "ko"), "날짜 미상");
  assert.equal(historyDate("invalid", "en"), "Date unavailable");
});

test("client drops stale session data, aborts unmounted reads and keeps retries on the failed cursor", () => {
  const code = readFileSync("src/components/MyHistory.tsx", "utf8");
  assert.match(code, /HistoryRecords key=\{ownerEmail\}/);
  assert.match(code, /data.ownerEmail !== ownerEmail/);
  assert.match(code, /setInvalidSession\(true\); setRecords\(\[\]\)/);
  assert.match(code, /active = false; window.clearTimeout\(timeout\); controller.abort\(\)/);
  assert.match(code, /cursor: error \? current.cursor : nextCursor/);
  assert.match(code, /method: "GET", cache: "no-store", credentials: "same-origin"/);
});

test("real history loader clears a mismatched account response and ignores a late response after unmount", async () => {
  for (const scenario of ["match", "mismatch", "logout", "unmount", "failure"]) {
    const states = [];
    let stateIndex = 0;
    let effect;
    let respond;
    let signal;
    const wait = new Promise((resolve) => { respond = resolve; });
    const hooks = { ...React, useEffect: (fn) => { effect = fn; }, useRef: () => ({ current: false }),
      useState: (initial) => {
        const index = stateIndex++;
        states[index] = index === 0 ? [{ id: "existing" }] : initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      }
    };
    const { HistoryRecords } = load("src/components/MyHistory.tsx", {
      "@/components/LanguageProvider": language("ko"), "next/link": link,
      "next-auth/react": { useSession: () => ({ status: "authenticated" }) }, react: hooks
    }, {
      window: { setTimeout, clearTimeout },
      fetch: async (url, init) => { assert.equal(url, "/api/activity-history/timeline"); signal = init.signal; return wait; }
    });
    HistoryRecords({ ownerEmail: owner });
    const cleanup = effect();
    if (scenario === "unmount") cleanup();
    respond(scenario === "logout" ? new Response("", { status: 401 }) : scenario === "failure" ? new Response("", { status: 503 })
      : Response.json({ ownerEmail: scenario === "mismatch" ? "other@example.test" : owner, records: [{ id: "loaded" }], nextCursor: null }));
    await new Promise((resolve) => setImmediate(resolve));
    if (scenario === "mismatch" || scenario === "logout") { assert.equal(states[0].length, 0); assert.equal(states[5], true); }
    if (scenario === "match") assert.equal(states[0][0].id, "loaded");
    if (scenario === "unmount") { assert.equal(states[0][0].id, "existing"); assert.equal(signal.aborted, true); }
    if (scenario === "failure") { assert.equal(states[0][0].id, "existing"); assert.equal(states[4], true); }
    cleanup();
  }
});
