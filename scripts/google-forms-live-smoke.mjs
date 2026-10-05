// Real Google API smoke test with a local persistent store, not a DB/auth E2E test.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { randomUUID, webcrypto, createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { web } = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(web.project_id, "kline-forms-test");
const connection = JSON.parse(readFileSync("private/google-forms-connection.local.json", "utf8"));
assert.equal(connection.account_email, "waterfallingsound0827@gmail.com");
const { encryptionKey } = JSON.parse(readFileSync("private/google-forms-oauth.local.json", "utf8"));
const statePath = "private/google-forms-live-smoke.local.json";
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {
  idempotencyKey: `live-smoke-${randomUUID()}`,
  title: "[KLINE PRIVATE TEST] ECC Gathering 2026-10-06",
  tables: { google_form_creation_attempts: [], google_forms: [] }
};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
save();
const clone = value => JSON.parse(JSON.stringify(value));
async function store(path, init = {}) {
  const [table, query = ""] = path.split("?");
  if (table === "google_oauth_connections") return [connection];
  const rows = state.tables[table];
  if (!rows) throw new Error("Unexpected local test table");
  const params = new URLSearchParams(query);
  const selected = rows.filter(row => [...params].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3)));
  if (init.method === "PATCH") {
    selected.forEach(row => Object.assign(row, JSON.parse(init.body))); save(); return clone(selected);
  }
  if (init.method === "POST") {
    const body = JSON.parse(init.body);
    const conflict = params.get("on_conflict")?.split(",") || (table === "google_form_creation_attempts" ? ["idempotency_key"] : []);
    const existing = conflict.length && rows.find(row => conflict.every(key => row[key] === body[key]));
    if (existing) return [];
    const row = { id: randomUUID(), remote_form_id: null, ...body };
    rows.push(row); save(); return clone([row]);
  }
  return clone(selected);
}
const env = {
  GOOGLE_FORMS_AUTOMATION_ENABLED: "true", GOOGLE_FORMS_ENVIRONMENT: "test",
  GOOGLE_FORMS_TEST_ORIGIN: "http://localhost:3300",
  GOOGLE_FORMS_CLIENT_ID: web.client_id, GOOGLE_FORMS_CLIENT_SECRET: web.client_secret,
  GOOGLE_TOKEN_ENCRYPTION_KEY: encryptionKey
};
const stubs = {
  "server-only": {}, "@/lib/googleForms/store": { supabaseRequest: store },
  "@/lib/admin": { normalizeEmail: value => (value || "").trim().toLowerCase() },
  "@/lib/supabaseServer": { cleanText: (value, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "" }
};
const modules = new Map();
async function checkedFetch(url, init) {
  const response = await fetch(url, init);
  if (!response.ok && String(url).startsWith("https://forms.googleapis.com/")) {
    const detail = await response.clone().json();
    console.error("Forms diagnostic:", response.status, new URL(url).pathname.split(":").at(-1), detail.error?.message);
  }
  return response;
}
function load(path) {
  const full = resolve(path);
  if (modules.has(full)) return modules.get(full).exports;
  const module = { exports: {} }; modules.set(full, module);
  const code = ts.transpileModule(readFileSync(full, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: { env }, fetch: checkedFetch, Response, Request, Headers, AbortSignal, URL, URLSearchParams, Buffer, crypto: webcrypto, Date, Map, Set })(id => {
    const normalized = id.startsWith(".") ? "@/" + resolve(dirname(full), id).split("/src/")[1] : id;
    if (stubs[normalized]) return stubs[normalized];
    return normalized.startsWith("@/") ? load(`src/${normalized.slice(2)}.ts`) : require(id);
  }, module, module.exports);
  return module.exports;
}
try {
  if (!state.draft) {
    state.draft = load("src/lib/googleForms/templates.ts").draftFromTemplate("ecc", "ecc_gathering", state.title);
    // Reconcile only this local smoke fixture after its initial unsaved draft.
    // Retain the existing remote form instead of issuing another create.
    for (const attempt of state.tables.google_form_creation_attempts) {
      assert.ok(attempt.remote_form_id && attempt.status === "configuring");
      attempt.draft_hash = createHash("sha256").update(JSON.stringify(state.draft)).digest("hex");
      state.fixtureReconciled = true;
    }
    save();
  }
  const draft = state.draft;
  const api = load("src/lib/googleForms/googleApi.ts");
  const row = await api.createGoogleForm(draft, connection.account_email, state.idempotencyKey);
  const duplicate = await api.createGoogleForm(draft, connection.account_email, state.idempotencyKey);
  assert.equal(row.google_form_id, duplicate.google_form_id);
  assert.equal(state.tables.google_forms.length, 1);
  const planning = load("src/lib/googleForms/planning.ts");
  const notice = planning.noticeWithFormUrl(planning.generateActivityNotice(draft), row.responder_url);
  assert.ok(notice.trim().split("\n").at(-1).endsWith(row.responder_url));
  const refreshToken = load("src/lib/googleForms/crypto.ts").decryptGoogleToken(connection.encrypted_refresh_token);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(20_000), body: new URLSearchParams({ client_id: web.client_id, client_secret: web.client_secret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const token = await tokenResponse.json();
  assert.ok(tokenResponse.ok && token.access_token, "Offline refresh failed");
  const remoteResponse = await fetch(`https://forms.googleapis.com/v1/forms/${row.google_form_id}`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(30_000) });
  assert.ok(remoteResponse.ok, "Independent Google read failed");
  const remote = await remoteResponse.json();
  assert.equal(remote.info.title, state.title);
  assert.equal(remote.items.length, draft.questions.length);
  assert.ok(remote.publishSettings?.publishState, "Publication state missing");
  assert.equal(Boolean(remote.publishSettings.publishState.isPublished), false);
  assert.equal(Boolean(remote.publishSettings.publishState.isAcceptingResponses), false);
  state.result = { checkedAt: new Date().toISOString(), scope: "real Google API; local store adapter; remote DB and Next.js auth NOT verified", title: state.title, questionCount: remote.items.length, formId: row.google_form_id, editUrl: row.edit_url, responderUrl: row.responder_url, unpublished: true, acceptingResponses: false, retrySameForm: true, notice };
  save(); console.log(JSON.stringify(state.result, null, 2));
} catch (error) {
  console.error(error.message);
  if (error.cause) console.error("Cause:", error.cause.message);
  process.exitCode = 1;
}
