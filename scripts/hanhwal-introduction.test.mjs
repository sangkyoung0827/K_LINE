import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

function routeHarness(access) {
  let stored = null;
  const writes = [];
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync("src/app/api/hanhwal/introduction/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const stubs = {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, body }) } },
    "@/lib/hanhwalAccess": { getCurrentHanhwalAccess: async () => access },
    "@/lib/readOnlyDeveloper": { isReadOnlyDeveloperEmail: (email) => email === "readonly@test" },
    "@/lib/supabaseServer": {
      cleanText: (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "",
      supabaseRequest: async (_path, options = {}) => {
        if (options.method === "POST") { writes.push(JSON.parse(options.body)); stored = writes.at(-1).content; return []; }
        return stored ? [{ content: stored }] : [];
      }
    }
  };
  vm.runInNewContext(code, { require: (name) => stubs[name], exports: module.exports, console: { error() {} }, Date });
  return { route: module.exports, writes };
}

const content = { titleKo: "한활", titleEn: "Hanhwal", bodyKo: "한국 활쏘기", bodyEn: "Korean archery" };
const request = (body) => ({ json: async () => body });

test("public introduction reads and unauthorized writes never alter content", async () => {
  for (const access of [{ isLoggedIn: false }, { isLoggedIn: true, email: "member@test", isAdmin: false }, { isLoggedIn: true, email: "readonly@test", isAdmin: true }]) {
    const h = routeHarness(access);
    assert.equal((await h.route.GET()).status, 200);
    assert.ok([401, 403].includes((await h.route.PATCH(request(content))).status));
    assert.equal(h.writes.length, 0);
  }
});

test("each appointed Hanhwal super admin can save introduction visible to readers", async () => {
  for (const email of ["sharon.winzzz@gmail.com", "trinhdo8399@gmail.com"]) {
    const h = routeHarness({ isLoggedIn: true, isAdmin: true, isSuperAdmin: true, email });
    assert.equal((await h.route.PATCH(request(content))).status, 200);
    assert.equal(h.writes[0].updated_by, email);
    assert.deepEqual(JSON.parse(JSON.stringify((await h.route.GET()).body.content)), content);
    assert.equal((await h.route.PATCH(request({ ...content, bodyKo: "" }))).status, 400);
    assert.equal(h.writes.length, 1);
  }
});
