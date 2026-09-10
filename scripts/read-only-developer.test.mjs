import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { encode, getToken } from "next-auth/jwt";

const email = "noritakeyuki@fuji.waseda.jp";
const secret = "test-only-not-a-production-secret";
function load(file, stubs, env = {}) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    Headers, Error, URL, console, process: { env },
  })((id) => {
    if (id in stubs) return stubs[id];
    throw new Error(`Unexpected import: ${id}`);
  }, module, module.exports);
  return module.exports;
}
const policy = load("src/lib/readOnlyDeveloper.ts", {});
const middleware = load("src/middleware.ts", {
  "next/server": { NextRequest, NextResponse },
  "next-auth/jwt": { getToken },
  "@/lib/readOnlyDeveloper": policy,
}, { AUTH_SECRET: secret }).middleware;

async function request(method, path, account = email, extraHeaders = {}) {
  const cookieName = "__Secure-authjs.session-token";
  const token = await encode({ token: { email: account }, secret, salt: cookieName });
  return new NextRequest(`https://kline.test${path}`, {
    method, headers: { cookie: `${cookieName}=${token}`, ...extraHeaders },
  });
}

test("designated email gets developer visibility independently of owner configuration", async () => {
  const admin = load("src/lib/admin.ts", {
    "@/lib/readOnlyDeveloper": policy,
    "@/lib/supabaseServer": { supabaseRequest: async () => [], SupabaseConfigError: Error, SupabaseRequestError: Error },
  }, { DEVELOPER_EMAILS: "owner@example.test" });
  const viewer = await admin.getAdminAccess(` ${email.toUpperCase()} `);
  assert.equal(viewer.isDeveloper, true);
  assert.equal(viewer.isReadOnly, true);
  assert.equal((await admin.getAdminAccess("owner@example.test")).isReadOnly, false);
  assert.equal((await admin.getAdminAccess("other@example.test")).isDeveloper, false);
});

test("verified viewer can navigate every developer screen and read APIs", async () => {
  for (const path of ["/developer", "/developer/woohyukmon-training", "/v4/traditional-liquor", "/api/admin/roles", "/api/ecc/operations", "/api/hanhwal/roles"]) {
    const response = await middleware(await request("GET", path));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get(`x-middleware-request-${policy.readOnlyDeveloperHeader}`), "1");
  }
});

test("viewer cannot write via API, page POST/server action, or JSON file-like URL", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    for (const path of ["/api/ecc/operations", "/api/ecc/registration-content", "/api/ecc/roles", "/api/hanhwal/roles", "/api/woohyukmon/operations", "/api/woohyukmon/uploads", "/developer", "/api/example.json"]) {
      const response = await middleware(await request(method, path, email, { "x-kline-read-only-developer": "0" }));
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "READ_ONLY_DEVELOPER");
    }
  }
});

test("writable owner and ordinary account behavior is unchanged; spoofed marker is stripped", async () => {
  for (const account of ["waterfallingsound0827@gmail.com", "normal@example.test"]) {
    const response = await middleware(await request("PATCH", "/api/ecc/operations", account, { [policy.readOnlyDeveloperHeader]: "1" }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get(`x-middleware-request-${policy.readOnlyDeveloperHeader}`), null);
  }
  const unauthenticated = await middleware(new NextRequest("https://kline.test/developer", {
    headers: { [policy.readOnlyDeveloperHeader]: "1", "x-email": email },
  }));
  assert.equal(unauthenticated.status, 307);
});

test("chunked encrypted session cookies and bearer sessions cannot bypass restriction", async () => {
  const cookieName = "__Secure-authjs.session-token";
  const token = await encode({ token: { email }, secret, salt: cookieName });
  const cut = Math.floor(token.length / 2);
  const chunked = new NextRequest("https://kline.test/api/ecc/operations", {
    method: "PATCH", headers: { cookie: `${cookieName}.0=${token.slice(0, cut)}; ${cookieName}.1=${token.slice(cut)}` },
  });
  assert.equal((await middleware(chunked)).status, 403);
  const bearer = new NextRequest("https://kline.test/api/ecc/operations", {
    method: "PATCH", headers: { authorization: `Bearer ${token}` },
  });
  assert.equal((await middleware(bearer)).status, 403);
});

test("even a GET handler cannot cause a Supabase write for the viewer", async () => {
  let marker = "1";
  const guard = load("src/lib/readOnlyDeveloperServer.ts", {
    "next/headers": { headers: async () => new Headers(marker ? { [policy.readOnlyDeveloperHeader]: marker } : {}) },
    "@/lib/readOnlyDeveloper": policy,
  });
  await assert.rejects(guard.assertDeveloperWriteAllowed(), /READ_ONLY_DEVELOPER/);
  marker = "";
  await guard.assertDeveloperWriteAllowed();
});
