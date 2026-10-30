import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);
export function loadJoinModule(file, mocks, globals = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { console: { error() {} }, Date, URL, ...globals })(
    (name) => name in mocks ? mocks[name] : require(name), module, module.exports
  );
  return module.exports;
}

class QAResponse extends Response {
  static json(body, options) { return new QAResponse(JSON.stringify(body), { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); }
  static redirect(url, status = 307) { return new QAResponse(null, { status, headers: { Location: String(url) } }); }
}
class QAStorageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function createHanhwalJoinHarness({ migrate = true } = {}) {
  const db = new PGlite();
  await db.exec("create schema auth; create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role', true) $$; create table hanhwal_member_registrations(id text primary key,data jsonb not null)");
  await db.exec(readFileSync("supabase/hanhwal_operational_settings.sql", "utf8"));
  await db.query("update hanhwal_operational_settings set official_team_chat_url=$1, period_label=$2, updated_by=$3 where id='current'", ["https://example.test/hanhwal-first", "2026 Fall", "original@example.test"]);
  const migration = readFileSync("supabase/migrations/20261030002929_hanhwal_team_chat_descriptions.sql", "utf8");
  if (migrate) await db.exec(migration);
  const state = {
    access: { email: "member@example.test", isLoggedIn: true, isOfficialMember: false, isAdmin: false },
    calls: [], failSettings: false, failSubmit: false, emptySave: false, siteRegistrations: 0
  };
  const supabaseRequest = async (path, init = {}) => {
    const url = new URL(path, "https://isolated.test/");
    const table = url.pathname.slice(1);
    assert.ok(["hanhwal_operational_settings", "hanhwal_member_registrations"].includes(table), "never access another club or production storage");
    const method = init.method || "GET";
    const payload = init.body ? JSON.parse(init.body) : null;
    state.calls.push({ path, method, payload });
    if (table === "hanhwal_operational_settings") {
      if (state.failSettings) throw new Error("settings unavailable");
      const columns = (url.searchParams.get("select") || "id").split(",");
      assert.ok(columns.every((name) => /^[a-z_]+$/.test(name)));
      try {
        if (method === "GET") return (await db.query(`select ${columns.join(",")} from hanhwal_operational_settings where id='current'`)).rows;
        assert.equal(method, "POST");
        if (state.emptySave) return [];
        const keys = Object.keys(payload);
        assert.ok(keys.every((name) => /^[a-z_]+$/.test(name)));
        return (await db.query(`insert into hanhwal_operational_settings (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) on conflict(id) do update set ${keys.filter((key) => key !== "id").map((key) => `${key}=excluded.${key}`).join(",")} returning ${columns.join(",")}`, keys.map((key) => payload[key]))).rows;
      } catch (error) {
        throw new QAStorageError(400, error.message);
      }
    }
    if (method !== "GET" && state.failSubmit) throw new Error("submission unavailable");
    if (method === "GET") {
      const email = url.searchParams.get("google_email")?.slice(3);
      assert.ok(email, "registration reads are bound to the signed-in email");
      return (await db.query("select data from hanhwal_member_registrations where data->>'google_email'=$1", [email])).rows.map((row) => row.data);
    }
    if (method === "POST") {
      const row = { ...payload, id: randomUUID() };
      await db.query("insert into hanhwal_member_registrations values($1,$2)", [row.id, row]);
      return [row];
    }
    assert.equal(method, "PATCH");
    const id = url.searchParams.get("id")?.slice(3);
    assert.ok(id);
    return (await db.query("update hanhwal_member_registrations set data=data || $2::jsonb where id=$1 returning data", [id, payload])).rows.map((row) => row.data);
  };
  const mocks = {
    "server-only": {},
    "@/auth": { auth: async () => state.access.isLoggedIn ? { user: { email: state.access.email, name: "Local member" } } : null },
    "@/lib/admin": { normalizeEmail: (value) => (value || "").trim().toLowerCase() },
    "@/lib/hanhwalAccess": { getCurrentHanhwalAccess: async () => state.access, getHanhwalOfficialTeamChatUrl: () => "https://example.test/hanhwal-default" },
    "@/lib/readOnlyDeveloper": { isReadOnlyDeveloperEmail: (email) => email === "readonly@example.test" },
    "@/lib/supabaseServer": { supabaseRequest, cleanText: (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "", SupabaseConfigError: class extends Error {}, SupabaseRequestError: QAStorageError },
    "@/lib/siteAnalytics": { registerSiteMember: async () => { state.siteRegistrations++; return { id: "local-site-member" }; } },
    "next/server": { NextResponse: QAResponse },
    qrcode: { default: QRCode }
  };
  const registrations = loadJoinModule("src/lib/hanhwalMemberRegistrations.ts", mocks);
  mocks["@/lib/hanhwalMemberRegistrations"] = registrations;
  const operations = loadJoinModule("src/lib/hanhwalOperations.ts", mocks);
  mocks["@/lib/hanhwalOperations"] = operations;
  mocks["@/lib/hanhwalJoin"] = loadJoinModule("src/lib/hanhwalJoin.ts", mocks);
  const routes = {
    registration: loadJoinModule("src/app/api/hanhwal/member-registration/route.ts", mocks),
    operations: loadJoinModule("src/app/api/hanhwal/operations/route.ts", mocks),
    teamChat: loadJoinModule("src/app/api/hanhwal/team-chat/route.ts", mocks),
    qr: loadJoinModule("src/app/api/hanhwal/official-team-qr/route.ts", mocks)
  };
  const form = { fullName: "Local Member", studentId: "202600001", departmentOrMajor: "Local department", nationality: "Local nationality", gender: "Prefer not to say", kakaoDisplayName: "Local Member", kakaoId: "local-member" };
  const call = (route, method = "GET", body = {}) => routes[route][method]({ url: "https://kline.test/api/hanhwal/team-chat", json: async () => body });
  const seedRegistration = async ({ email = state.access.email, approved = false, status } = {}) => {
    const row = { id: randomUUID(), google_email: email, google_name: "Local Member", full_name: form.fullName, student_id: form.studentId, department_or_major: form.departmentOrMajor, nationality: form.nationality, gender: form.gender, kakao_display_name: form.kakaoDisplayName, kakao_id: form.kakaoId, payment_confirmed: approved, official_member: approved, status: status || (approved ? "approved" : "payment_pending"), created_at: "2026-10-01T00:00:00Z", admin_note: "" };
    await db.query("insert into hanhwal_member_registrations values($1,$2)", [row.id, row]);
    return row;
  };
  return { db, state, form, routes, call, registrations, operations, migration, seedRegistration, close: () => db.close() };
}
