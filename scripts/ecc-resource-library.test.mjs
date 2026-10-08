import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const require = createRequire(import.meta.url);
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
const json = (body, options = {}) => ({ body, status: options.status || 200 });
const request = (method, path, body) => new Request(`https://kline.test${path}`, {
  method, headers: { origin: "https://kline.test", "content-type": "application/json" },
  body: body ? JSON.stringify(body) : undefined
});

function route(file, stubs) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console, Date, Request, Response, Headers, URL, fetch: stubs.__fetch || fetch
  })((name) => stubs[name] || require(name), module, module.exports);
  return module.exports;
}

test("storage inspection uses file metadata, not HEAD response headers", async () => {
  let requested = "";
  const api = route("src/lib/eccResources/storage.ts", {
    "server-only": {},
    "@/lib/supabaseServer": {
      getSupabaseConfig: () => ({ url: "https://files.test", serviceRoleKey: "test-key" }),
      SupabaseRequestError: class extends Error {}
    },
    __fetch: async (url, options) => {
      requested = `${options.method || "GET"} ${url}`;
      return new Response(JSON.stringify({ size: 101, content_type: "text/plain;charset=UTF-8" }), { status: 200 });
    }
  });
  const info = await api.inspectResourceFile(`${id}/file.txt`);
  assert.equal(info.sizeBytes, 101);
  assert.equal(info.mimeType, "text/plain");
  assert.equal(requested, `GET https://files.test/storage/v1/object/info/ecc-resource-library/${id}/file.txt`);
});

const noAccess = { email: "", canUpload: false, isAdmin: false };
const resource = {
  id, status: "pending", uploader_email: "uploader@test", storage_path: `${id}/file.pptx`,
  size_bytes: 1024, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
const stubs = (server, storage = {}) => {
  server.ResourceInputError ??= class extends Error {};
  return {
  "next/server": { NextResponse: { json, redirect: (url, options = {}) => ({ url, status: options.status || 302 }) } },
  "@/lib/supabaseServer": { SupabaseConfigError: class extends Error {}, SupabaseRequestError: class extends Error {} },
  "@/lib/eccResources/server": server,
  "@/lib/eccResources/storage": storage,
  "@/lib/eccResources/model": { canPreviewResource: () => false }
  };
};

test("resource migration is additive, repeatable, and denies direct browser access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table club_board_posts(id text primary key,title text);
      insert into club_board_posts values('old-post','Existing ECC post');`);
    const sql = readFileSync("supabase/ecc_resource_library.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);
    assert.deepEqual((await db.query("select * from club_board_posts")).rows, [{ id: "old-post", title: "Existing ECC post" }]);
    assert.equal((await db.query("select count(*)::int as n from storage.buckets where id='ecc-resource-library' and public=false")).rows[0].n, 1);
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='ecc_resource_files'")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from ecc_resource_files"), /permission denied/);
      await db.exec("reset role");
    }
    assert.doesNotMatch(sql, /(?:alter|drop|delete from|update)\s+(?:table\s+)?(?:public\.)?(?:ecc_roles|ecc_member|club_board_posts|hanhwal_|user_activity_records)/i);
  } finally { await db.close(); }
});

test("public file access excludes pending uploads and never signs them", async () => {
  let signed = 0;
  const server = { getResource: async () => resource, isResourceId: () => true };
  const api = route("src/app/api/ecc/resources/[id]/file/route.ts", stubs(server, {
    createResourceReadUrl: async () => { signed++; return "https://files.test/file"; }
  }));
  const path = `/api/ecc/resources/${id}/file`;
  assert.equal((await api.GET(request("GET", path), context)).status, 404);
  assert.equal(signed, 0);
  server.getResource = async () => ({ ...resource, status: "published" });
  assert.equal((await api.GET(request("GET", path), context)).status, 302);
  assert.equal(signed, 1);
});

test("only official members can initiate an ECC resource upload", async () => {
  let writes = 0;
  const server = {
    sameOrigin: () => true,
    getResourceAccess: async () => noAccess,
    createPendingResource: async () => { writes++; return resource; },
    deleteResource: async () => {}
  };
  const api = route("src/app/api/ecc/resources/route.ts", stubs(server, {
    createResourceUploadUrl: async () => ({ token: "token", endpoint: "https://files.test" })
  }));
  const result = await api.POST(request("POST", "/api/ecc/resources", { title: "Slides" }));
  assert.equal(result.status, 403);
  assert.equal(writes, 0);
});

test("upload ticket includes a signed standard URL for direct browser upload", async () => {
  const server = {
    sameOrigin: () => true,
    getResourceAccess: async () => ({ email: "member@test", canUpload: true }),
    createPendingResource: async () => resource,
    deleteResource: async () => { throw new Error("unexpected cleanup"); }
  };
  const api = route("src/app/api/ecc/resources/route.ts", stubs(server, {
    createResourceUploadUrl: async () => ({ token: "token", endpoint: "https://files.test/tus", signedUrl: "https://files.test/signed" })
  }));
  const result = await api.POST(request("POST", "/api/ecc/resources", { title: "Slides" }));
  assert.equal(result.status, 201);
  assert.equal(result.body.signedUrl, "https://files.test/signed");
});

test("only the uploader can publish after storage size and type match", async () => {
  let writes = 0;
  const server = {
    sameOrigin: () => true, isResourceId: () => true,
    getResourceAccess: async () => ({ email: "other@test", canUpload: true }),
    getResource: async () => resource,
    publishResource: async () => { writes++; return { ...resource, status: "published" }; },
    toPublicResource: (value) => value
  };
  const storage = { inspectResourceFile: async () => ({ sizeBytes: resource.size_bytes, mimeType: resource.mime_type }) };
  const api = route("src/app/api/ecc/resources/[id]/publish/route.ts", stubs(server, storage));
  const path = `/api/ecc/resources/${id}/publish`;
  assert.equal((await api.POST(request("POST", path), context)).status, 404);
  server.getResourceAccess = async () => ({ email: resource.uploader_email, canUpload: true });
  storage.inspectResourceFile = async () => ({ sizeBytes: resource.size_bytes - 1, mimeType: resource.mime_type });
  assert.equal((await api.POST(request("POST", path), context)).status, 400);
  assert.equal(writes, 0);
  storage.inspectResourceFile = async () => ({ sizeBytes: resource.size_bytes, mimeType: resource.mime_type });
  assert.equal((await api.POST(request("POST", path), context)).status, 200);
  assert.equal(writes, 1);
});

test("public listing returns published resources without requiring a session", async () => {
  const server = { listResources: async () => [{ id, title: "ECC slides" }] };
  const api = route("src/app/api/ecc/resources/route.ts", stubs(server));
  const result = await api.GET();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.resources, [{ id, title: "ECC slides" }]);
});

test("resource deletion is limited to ECC administrators", async () => {
  let deleted = 0;
  const server = {
    sameOrigin: () => true, isResourceId: () => true,
    getResourceAccess: async () => ({ email: "member@test", isAdmin: false }),
    getResource: async () => ({ ...resource, status: "published" }),
    deleteResource: async () => { deleted++; }
  };
  const api = route("src/app/api/ecc/resources/[id]/route.ts", stubs(server, {
    deleteResourceFile: async () => {}
  }));
  assert.equal((await api.DELETE(request("DELETE", `/api/ecc/resources/${id}`), context)).status, 403);
  assert.equal(deleted, 0);
});

test("category migration is repeatable and preserves existing resources, boards and permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table club_board_posts(id text primary key,title text);
      insert into club_board_posts values('old-post','Existing post');`);
    await db.exec(readFileSync("supabase/ecc_resource_library.sql", "utf8"));
    await db.exec(`insert into ecc_resource_files(id,title,description,file_name,mime_type,size_bytes,storage_path,uploader_email,status)
      values('${id}','Existing slides','Original description','slides.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',1024,'${id}/slides.pptx','uploader@test','published');`);
    const original = (await db.query("select * from ecc_resource_files")).rows[0];
    const sql = readFileSync("supabase/migrations/20261008175316_ecc_resource_categories.sql", "utf8");
    await db.exec(sql); await db.exec(sql);
    const { category, ...preserved } = (await db.query("select * from ecc_resource_files")).rows[0];
    assert.equal(category, "other");
    assert.deepEqual(preserved, original);
    await db.exec(`update ecc_resource_files set category='mt' where id='${id}'`);
    await db.exec(sql);
    assert.equal((await db.query("select category from ecc_resource_files")).rows[0].category, "mt");
    await assert.rejects(db.exec(`update ecc_resource_files set category='invalid'`), /check constraint/);
    assert.equal((await db.query("select title from club_board_posts")).rows[0].title, "Existing post");
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='ecc_resource_files'")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from ecc_resource_files"), /permission denied/);
      await assert.rejects(db.exec(`update ecc_resource_files set category='notice'`), /permission denied/);
      await db.exec("reset role");
    }
  } finally { await db.close(); }
});

function resourceServer(requests) {
  const model = route("src/lib/eccResources/model.ts", {});
  return route("src/lib/eccResources/server.ts", {
    "server-only": {},
    "@/auth": { auth: async () => ({ user: { name: "Uploader" } }) },
    "@/lib/eccAccess": {}, "@/lib/readOnlyDeveloper": {},
    "@/lib/supabaseServer": {
      cleanText: (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "",
      supabaseRequest: async (path, options = {}) => { requests.push({ path, options }); return [{ ...resource, category: "mt" }]; }
    }, "./model": model
  });
}

test("category updates change only category on published rows and reject unknown values", async () => {
  const requests = [];
  const server = resourceServer(requests);
  await server.updateResourceCategory(id, "mt");
  assert.equal(requests.length, 1);
  assert.match(requests[0].path, /status=eq.published/);
  assert.equal(requests[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0].options.body), { category: "mt" });
  for (const value of [undefined, null, "invalid", "", { id: "mt" }]) await assert.rejects(server.updateResourceCategory(id, value), /valid resource category/);
  assert.equal(requests.length, 1);
});

test("new uploads persist selected category; legacy requests default to Other", async () => {
  const requests = [];
  const server = resourceServer(requests);
  const input = { title: "Class slides", fileName: "slides.pptx", sizeBytes: 1024 };
  await server.createPendingResource({ ...input, category: "class-research" }, "uploader@test");
  assert.equal(JSON.parse(requests[0].options.body).category, "class-research");
  await server.createPendingResource(input, "uploader@test");
  assert.equal(JSON.parse(requests[1].options.body).category, "other");
  await assert.rejects(server.createPendingResource({ ...input, category: "unknown" }, "uploader@test"), /valid resource category/);
  assert.equal(requests.length, 2);
});

test("public category projection retains legacy reads without leaking private columns", async () => {
  const server = resourceServer([]);
  const original = { ...resource, category: undefined, title: "Original" };
  const publicRow = server.toPublicResource(original);
  assert.equal(publicRow.category, "other");
  assert.equal(server.toPublicResource({ ...original, category: "notice" }).category, "notice");
  assert.equal(publicRow.uploader_email, undefined);
  assert.equal(publicRow.storage_path, undefined);
  assert.equal(original.category, undefined);
});

test("only ECC administrators can reclassify; cross-origin writes are denied", async () => {
  let writes = 0;
  const server = {
    sameOrigin: () => true, isResourceId: () => true,
    getResourceAccess: async () => ({ email: "member@test", isAdmin: false }),
    updateResourceCategory: async () => { writes++; return { ...resource, category: "notice", status: "published" }; },
    toPublicResource: (row) => row
  };
  const api = route("src/app/api/ecc/resources/[id]/route.ts", stubs(server));
  const path = `/api/ecc/resources/${id}`;
  assert.equal((await api.PATCH(request("PATCH", path, { category: "notice" }), context)).status, 403);
  assert.equal(writes, 0);
  server.getResourceAccess = async () => ({ email: "admin@test", isAdmin: true });
  server.sameOrigin = () => false;
  assert.equal((await api.PATCH(request("PATCH", path, { category: "notice" }), context)).status, 403);
  assert.equal(writes, 0);
  server.sameOrigin = () => true;
  const result = await api.PATCH(request("PATCH", path, { category: "notice", title: "Must not change" }), context);
  assert.equal(result.status, 200);
  assert.equal(result.body.resource.category, "notice");
  assert.equal(writes, 1);
  server.updateResourceCategory = async () => null;
  assert.equal((await api.PATCH(request("PATCH", path, { category: "mt" }), context)).status, 404);
});

test("invalid category returns a validation error rather than a write", async () => {
  class ResourceInputError extends Error {}
  const server = {
    ResourceInputError, sameOrigin: () => true, isResourceId: () => true,
    getResourceAccess: async () => ({ isAdmin: true }),
    updateResourceCategory: async () => { throw new ResourceInputError("Choose a valid resource category."); }
  };
  const api = route("src/app/api/ecc/resources/[id]/route.ts", stubs(server));
  assert.equal((await api.PATCH(request("PATCH", `/api/ecc/resources/${id}`, { category: "invalid" }), context)).status, 400);
});

test("category release does not seed preview files or import the isolated fixture", () => {
  for (const file of ["src/components/EccResourceLibrary.tsx", "src/components/EccResourceDetail.tsx", "src/lib/eccResources/server.ts", "src/app/api/ecc/resources/route.ts", "src/app/api/ecc/resources/[id]/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /ecc-resource-categories-preview|ECC 샘플|ecc-resource-category-upload-test|\[로컬 테스트\] 연구 참고자료/);
  }
  const sql = readFileSync("supabase/migrations/20261008175316_ecc_resource_categories.sql", "utf8");
  assert.doesNotMatch(sql, /\b(?:insert|delete|truncate|drop|update)\b/i);
});
