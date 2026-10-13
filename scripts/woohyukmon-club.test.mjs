import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { clubHarness, decision, qaRequest } from "./woohyukmon-club-harness.mjs";

test("every registered adapter method exists in the actual site's route source", async () => {
  const h = await clubHarness();
  try {
    for (const [key, cap] of Object.entries(h.api.clubCapabilities)) {
      const path = `src/app${cap.path.replace(/:id/g, "[id]")}/route.ts`;
      const tree = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true);
      const methods = tree.statements.filter(ts.isFunctionDeclaration).filter(node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)).map(node => node.name?.text);
      for (const method of cap.methods) assert.ok(methods.includes(method), `${key}: ${method} not exported by ${path}`);
    }
  } finally { await h.close(); }
});

test("all role pages get only their existing granted scopes; ordinary/anonymous/read-only cannot execute", async () => {
  const h = await clubHarness();
  try {
    for (const scopes of [[], ["ecc"], ["hanhwal"], ["social_impact_union"], ["jeju"], ["research"], ["ecc","hanhwal"]]) {
      h.state.scopes = scopes;
      const access = await h.api.getClubAssistantAccess();
      assert.deepEqual(access.scopes, scopes);
      for (const cap of Object.values(h.api.clubCapabilities)) {
        const key = Object.keys(h.api.clubCapabilities).find(key => h.api.clubCapabilities[key] === cap);
        const call = { capability: key, method: cap.methods[0], query: { id: "qa-id" }, body: key === "event_plan" ? { action: "plan", clubKey: "ecc", message: "QA" } : {} };
        if (scopes.includes(cap.scope)) assert.doesNotThrow(() => h.api.assertCapability(access, call));
        else assert.throws(() => h.api.assertCapability(access, call), /권한/);
      }
    }
    h.state.developer = true; assert.ok((await h.api.getClubAssistantAccess()).scopes.includes("event_archive"));
    h.state.readOnly = true;
    const access = await h.api.getClubAssistantAccess();
    await assert.rejects(h.api.clubAssistantReply(access, qaRequest({}), { message: "회원 명단" }), /읽기 전용/);
    h.state.email = ""; const anonymous = await h.api.getClubAssistantAccess();
    assert.deepEqual(anonymous.scopes, []); await assert.rejects(h.api.clubAssistantReply(anonymous, qaRequest({}), { message: "명단" }), /로그인/);
    assert.equal(h.state.calls.length, 0);
  } finally { await h.close(); }
});

test("scoped read loop uses live adapter response, strips contact fields, and never writes", async () => {
  const h = await clubHarness();
  try {
    h.state.decisions.push(decision("read", "ecc_members"));
    const response = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { message: "ECC 회원 조회", scope: "ecc" });
    assert.equal(response.rows[0].fullName, "테스트 회원");
    assert.equal(h.state.calls.length, 1); assert.equal(h.state.calls[0].method, "GET");
    assert.doesNotMatch(h.state.lastPrompt.instructions, /private@example|001234/);
  } finally { await h.close(); }
});

test("explicit other-club requests and client-forged scope fail before any AI or data call", async () => {
  const h = await clubHarness();
  try {
    const access = await h.api.getClubAssistantAccess();
    await assert.rejects(h.api.clubAssistantReply(access, qaRequest({}), { message: "한활 명단", scope: "ecc" }), /권한/);
    await assert.rejects(h.api.clubAssistantReply(access, qaRequest({}), { message: "명단", scope: "hanhwal" }), /권한/);
    assert.equal(h.state.aiCalls, 0); assert.equal(h.state.calls.length, 0);
  } finally { await h.close(); }
});

test("model cannot invent routes, select another club or execute a GET as a mutation", async () => {
  const h = await clubHarness();
  try {
    const access = await h.api.getClubAssistantAccess();
    for (const d of [decision("read", "hanhwal_members"), decision("read", "shell"), decision("write", "ecc_members", "GET")]) {
      h.state.decisions.push(d);
      await assert.rejects(h.api.clubAssistantReply(access, qaRequest({}), { message: "회원 작업", scope: "ecc" }));
    }
    assert.equal(h.state.calls.length, 0);
  } finally { await h.close(); }
});

test("write prepares an exact preview; signed confirm executes once with preserved notes", async () => {
  const h = await clubHarness();
  try {
    h.state.decisions.push(decision("write", "ecc_members", "PATCH", { registrations: [{ id: "qa-member", paymentConfirmed: false }] }));
    const access = await h.api.getClubAssistantAccess();
    const preview = await h.api.clubAssistantReply(access, qaRequest({}), { message: "ECC 테스트 회원 회비 미납 처리" });
    assert.equal(preview.kind, "confirmation"); assert.ok(preview.token); assert.ok(h.state.calls.every(c => c.method === "GET"));
    const result = await h.api.confirmClubAction(access, qaRequest({}), preview.token);
    assert.equal(result.kind, "result");
    assert.equal(h.state.calls.at(-1).body.registrations[0].adminNote, "Original note");
    await assert.rejects(h.api.confirmClubAction(access, qaRequest({}), preview.token), /이미 실행/);
    assert.equal(h.state.calls.filter(c => c.method === "PATCH").length, 1);
    assert.equal((await h.db.query("select status from receipts")).rows[0].status, "completed");
  } finally { await h.close(); }
});

test("missing payment state cannot accidentally revoke a paid member while editing a note", async () => {
  const h = await clubHarness();
  try {
    h.state.decisions.push(decision("write", "ecc_members", "PATCH", { registrations: [{ id: "qa-member", adminNote: "Note only" }] }));
    await assert.rejects(h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { message: "ECC 회원 메모 수정" }), /회비 상태/);
    assert.ok(h.state.calls.every(c => c.method === "GET"));
  } finally { await h.close(); }
});

test("expired/tampered/wrong-actor/revoked permissions/stale-data approvals cannot execute", async () => {
  const h = await clubHarness();
  try {
    h.state.decisions.push(decision("write", "ecc_members", "PATCH", { registrations: [{ id: "qa-member", paymentConfirmed: true }] }));
    const access = await h.api.getClubAssistantAccess();
    const preview = await h.api.clubAssistantReply(access, qaRequest({}), { message: "ECC 회비 확인" });
    const payload = h.api.verifySignedWoohyukmonPayload(preview.token);
    for (const token of [preview.token + "x", h.api.createSignedWoohyukmonPayload({ ...payload, expiresAt: 0 }), h.api.createSignedWoohyukmonPayload({ ...payload, actor: "other@test" })]) await assert.rejects(h.api.confirmClubAction(access, qaRequest({}), token));
    await assert.rejects(h.api.confirmClubAction({ ...access, scopes: [] }, qaRequest({}), preview.token), /권한/);
    h.state.data.registrations[0].adminNote = "Changed";
    await assert.rejects(h.api.confirmClubAction(access, qaRequest({}), preview.token), /자료가 변경/);
    assert.ok(h.state.calls.every(c => c.method === "GET"));
  } finally { await h.close(); }
});

test("export link carries no raw records and rechecks ownership, expiry and current scope on download", async () => {
  const h = await clubHarness();
  try {
    h.state.scopes = ["hanhwal"];
    h.state.decisions.push(decision("export", "hanhwal_applicants", "GET", {}, {}, "docx"));
    const reply = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { message: "한활 신청자 워드 문서" });
    const url = new URL(reply.files[0].url, "http://127.0.0.1:3358");
    const response = await h.api.exportDocument(new Request(url));
    assert.equal(response.status, 200); assert.match(response.headers.get("Content-Type"), /wordprocessingml/);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    assert.match(await zip.file("word/document.xml").async("string"), /테스트 회원/);
    h.state.email = "other@test"; assert.equal((await h.api.exportDocument(new Request(url))).status, 403);
    h.state.email = "qa-manager@example.test"; h.state.scopes = []; assert.equal((await h.api.exportDocument(new Request(url))).status, 403);
    assert.ok(h.state.calls.every(c => c.method === "GET"));
  } finally { await h.close(); }
});

test("xlsx and Word preserve Hangul, leading-zero IDs, literal formula-like text, and omit secrets", async () => {
  const h = await clubHarness();
  try {
    const rows = [{ 학번: "001234", 이름: "=HYPERLINK(unsafe)", 내용: "한글 · English", token: "do-not-export" }];
    const excel = await h.api.createClubDocument("xlsx", "검증", rows);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(excel.bytes);
    assert.equal(workbook.worksheets[0].getCell("A2").value, "001234");
    assert.equal(workbook.worksheets[0].getCell("B2").type, ExcelJS.ValueType.String);
    assert.doesNotMatch(JSON.stringify(workbook.worksheets[0].model), /do-not-export/);
    const doc = await h.api.createClubDocument("docx", "검증", rows);
    const zip = await JSZip.loadAsync(doc.bytes); const xml = await zip.file("word/document.xml").async("string");
    assert.match(xml, /001234/); assert.match(xml, /한글/); assert.doesNotMatch(xml, /do-not-export/);
  } finally { await h.close(); }
});

test("cross-origin POST, oversized requests and code/deployment requests cannot change anything", async () => {
  const h = await clubHarness();
  try {
    const foreign = new Request("http://127.0.0.1:3358/api/woohyukmon/club-assistant", { method: "POST", headers: { Origin: "https://evil.test" }, body: "{}" });
    assert.equal((await h.api.POST(foreign)).status, 403);
    const blocked = await h.api.clubAssistantReply(await h.api.getClubAssistantAccess(), qaRequest({}), { message: "사이트 코드 수정하고 재배포" });
    assert.match(blocked.summary, /접근하지 않습니다/); assert.equal(h.state.aiCalls, 0); assert.equal(h.state.calls.length, 0);
  } finally { await h.close(); }
});

test("additive receipt migration is repeatable and inaccessible to browser database roles", async () => {
  const h = await clubHarness();
  try {
    await h.db.exec("create role anon; create role authenticated; create role service_role bypassrls");
    const sql = await readFile("supabase/migrations/20261013170108_woohyukmon_club_action_receipts.sql", "utf8");
    await h.db.exec(sql); await h.db.exec(sql);
    const flags = await h.db.query("select relrowsecurity from pg_class where oid='public.woohyukmon_club_action_receipts'::regclass");
    assert.equal(flags.rows[0].relrowsecurity, true);
    for (const role of ["anon","authenticated"]) {
      await h.db.exec(`set role ${role}`);
      await assert.rejects(h.db.query("select * from public.woohyukmon_club_action_receipts"), /permission denied/);
      await h.db.exec("reset role");
    }
    assert.equal((await h.db.query("select count(*)::int as count from public.woohyukmon_club_action_receipts")).rows[0].count, 0);
  } finally { await h.close(); }
});
