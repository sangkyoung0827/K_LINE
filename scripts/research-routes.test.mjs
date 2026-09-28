import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
const response = (body, options = {}) => ({ body, status: options.status || 200 });
const request = (method, body) => new Request(`https://kline.test/api/research/${id}`, {
  method,
  headers: { origin: "https://kline.test", "content-type": "application/json" },
  body: JSON.stringify(body)
});

function route(path, stubs) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console, Date, File, FormData, Request, Response, URL, Headers
  })((name) => stubs[name] || require(name), module, module.exports);
  return module.exports;
}

const item = { id, status: "draft", visibility: "private", coverPath: "", imagePaths: [], attachmentPaths: [], publishedAt: "", isSample: false };
const access = (canEdit) => ({
  getResearchEditorAccess: async () => ({ email: "editor@test", canEdit }),
  getResearchItem: async () => item,
  isResearchId: () => true,
  sameOrigin: () => true,
  ResearchInputError: class extends Error {}
});
const common = (server) => ({
  "next/server": { NextResponse: { json: response } },
  "@/lib/supabaseServer": { SupabaseConfigError: class extends Error {}, SupabaseRequestError: class extends Error {} },
  "@/lib/research/model": { isPublicResearch: (value) => value.status === "published" && value.visibility === "public", toPublicResearchItem: (value) => value },
  "@/lib/research/server": server,
  "@/lib/research/storage": { deleteResearchFiles: async () => {} }
});

test("research creation requires editor access and always starts as a private draft", async () => {
  let writes = 0;
  const server = {
    ...access(false),
    cleanResearchInput: (value) => value,
    insertResearchItem: async (value) => { writes++; return value; }
  };
  const api = route("src/app/api/research/route.ts", common(server));
  assert.equal((await api.POST(request("POST", { titleKo: "Test" }))).status, 403);
  assert.equal(writes, 0);
  server.getResearchEditorAccess = async () => ({ email: "editor@test", canEdit: true });
  const created = await api.POST(request("POST", { titleKo: "Test", status: "published", visibility: "public" }));
  assert.equal(created.status, 201);
  assert.equal(created.body.item.status, "draft");
  assert.equal(created.body.item.visibility, "private");
});

test("research publishing needs a cover; anonymous users cannot update or delete", async () => {
  let writes = 0;
  const server = {
    ...access(false), cleanResearchInput: (value) => value,
    updateResearchItem: async () => { writes++; return item; },
    deleteResearchItem: async () => { writes++; }
  };
  const api = route("src/app/api/research/[id]/route.ts", common(server));
  const publish = () => request("PATCH", { status: "published", visibility: "public" });
  assert.equal((await api.PATCH(publish(), context)).status, 403);
  assert.equal((await api.DELETE(request("DELETE", {}), context)).status, 403);
  server.getResearchEditorAccess = async () => ({ email: "editor@test", canEdit: true });
  assert.equal((await api.PATCH(publish(), context)).status, 400);
  assert.equal(writes, 0);
  item.coverPath = `${id}/22222222-2222-4222-8222-222222222222.jpg`;
  assert.equal((await api.PATCH(publish(), context)).status, 200);
  assert.equal(writes, 1);
  item.coverPath = "";
});

test("a published research cover cannot be removed without replacement", async () => {
  let writes = 0;
  const published = { ...item, status: "published", coverPath: `${id}/22222222-2222-4222-8222-222222222222.jpg` };
  const server = {
    ...access(true), getResearchItem: async () => published,
    updateResearchItem: async () => { writes++; return published; }
  };
  const api = route("src/app/api/research/[id]/upload/route.ts", common(server));
  const result = await api.DELETE(request("DELETE", { path: published.coverPath }), context);
  assert.equal(result.status, 400);
  assert.equal(writes, 0);
});
