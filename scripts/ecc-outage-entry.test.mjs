import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
class SupabaseRequestError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}
class SupabaseConfigError extends Error {}
function load(file, stubs, globals = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    Buffer, Date, Error, TypeError, AbortSignal, URL, console: { error() {} },
    setTimeout: (fn) => setTimeout(fn, 0), clearTimeout, ...globals,
  })((id) => {
    if (id in stubs) return stubs[id];
    if (id.startsWith("node:")) return require(id);
    throw new Error(`Unexpected dependency ${id}`);
  }, module, module.exports);
  return module.exports;
}
const retry = load("src/lib/eccAccessRetry.ts", {
  "@/lib/supabaseServer": { SupabaseRequestError },
});
const tokens = load("src/lib/eccTemporaryEntry.ts", {});

test("stalled supporting lookups have a deadline", async () => {
  await assert.rejects(retry.withinEccLookupDeadline(new Promise(() => {})), { name: "TimeoutError" });
  assert.equal(await retry.withinEccLookupDeadline(Promise.resolve("ready")), "ready");
});

test("transient failures retry twice then recover; permanent failures are not retried", async () => {
  let attempts = 0;
  assert.equal(await retry.retryEccLookup(async (signal) => {
    assert.ok(signal instanceof AbortSignal);
    if (++attempts < 3) throw new SupabaseRequestError(503);
    return "approved";
  }), "approved");
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(retry.retryEccLookup(async () => {
    attempts++; throw new SupabaseRequestError(403);
  }));
  assert.equal(attempts, 1);
});

function accessHarness(read, email = "member@example.test") {
  return load("src/lib/eccAccess.ts", {
    "server-only": {}, "@/auth": { auth: async () => email ? { user: { email } } : null },
    "@/lib/admin": { normalizeEmail: (e) => (e ?? "").trim().toLowerCase(),
      getAdminAccess: async () => ({ isDeveloper: false, isSuperAdmin: false }) },
    "@/lib/eccAccessRetry": retry,
    "@/lib/supabaseServer": { SupabaseRequestError, SupabaseConfigError, supabaseRequest: read },
  });
}

test("failed lookup is distinct from unapproved membership and never grants shared permissions", async () => {
  let attempts = 0;
  const h = accessHarness(async (path, init) => {
    assert.equal(init.cache, "no-store");
    attempts++; throw new SupabaseRequestError(503);
  });
  const access = await h.getCurrentEccAccess();
  assert.equal(attempts, 3);
  assert.equal(access.lookupFailed, true);
  assert.equal(access.temporaryEntryEligible, true);
  assert.equal(access.isOfficialMember, false);
  assert.equal(access.isAdmin, false);
  const negative = await accessHarness(async () => []).getCurrentEccAccess();
  assert.equal(negative.isOfficialMember, false);
  assert.equal(negative.lookupFailed, undefined);
  const configFailure = await accessHarness(async () => { throw new SupabaseConfigError(); }).getCurrentEccAccess();
  assert.equal(configFailure.temporaryEntryEligible, false);
});

test("approved member recovers automatically; logged-out visitors do not query roles", async () => {
  let attempts = 0;
  const access = await accessHarness(async () => {
    if (++attempts === 1) throw new TypeError("fetch failed");
    return [{ official_member_status: "approved" }];
  }).getCurrentEccAccess();
  assert.equal(access.isOfficialMember, true);
  assert.equal(attempts, 2);
  assert.equal(access.lookupFailed, undefined);
  const guest = await accessHarness(async () => { throw Error("Unexpected query"); }, null).getCurrentEccAccess();
  assert.equal(guest.isLoggedIn, false);
});

test("entry token is account-bound, signed, expires, and cannot be used with a different key", () => {
  const now = 1000000;
  const token = tokens.issueEccEntry("a@test", "secret", now);
  assert.equal(tokens.validEccEntry(token, "a@test", "secret", now), true);
  assert.equal(tokens.validEccEntry(token, "b@test", "secret", now), false);
  assert.equal(tokens.validEccEntry(token, "a@test", "different", now), false);
  assert.equal(tokens.validEccEntry(token + "x", "a@test", "secret", now), false);
  assert.equal(tokens.validEccEntry(token, "a@test", "secret", now + 900000), false);
  assert.equal(tokens.validEccEntry(token, "a@test", "", now), false);
});

test("entry endpoint rechecks outage, login, declaration and origin without any DB writes", async () => {
  let access = { email: "a@test", isLoggedIn: true, isOfficialMember: false,
    lookupFailed: true, temporaryEntryEligible: true };
  const route = load("src/app/api/ecc/temporary-entry/route.ts", {
    "next/server": { NextResponse: { json: (body, options = {}) => ({
      body, status: options.status ?? 200, cookies: { set(...args) { this.value = args; } },
    }) } },
    "@/lib/eccAccess": { getCurrentEccAccess: async () => access },
    "@/lib/eccTemporaryEntry": tokens,
  }, { process: { env: { AUTH_SECRET: "secret", NODE_ENV: "production" } } });
  const request = (origin = "https://kline.test", paid = true) => ({
    url: "https://kline.test/api/ecc/temporary-entry", headers: new Headers({ origin }),
    json: async () => ({ paid }),
  });
  assert.equal((await route.POST(request("https://evil.test"))).status, 403);
  assert.equal((await route.POST(request(undefined, false))).status, 400);
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  const [name, token, options] = response.cookies.value;
  assert.equal(name, tokens.eccEntryCookie);
  assert.equal(tokens.validEccEntry(token, "a@test", "secret"), true);
  assert.equal(options.path, "/ecc-official");
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  access = { ...access, lookupFailed: false };
  assert.equal((await route.POST(request())).status, 403);
  access = { ...access, isOfficialMember: true };
  assert.equal((await route.POST(request())).cookies.value, undefined);
  access = { ...access, isLoggedIn: false };
  assert.equal((await route.POST(request())).status, 401);
});
