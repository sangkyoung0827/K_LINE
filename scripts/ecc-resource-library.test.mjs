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
    console, Date, Request, Response, Headers, URL
  })((name) => stubs[name] || require(name), module, module.exports);
  return module.exports;
}

const noAccess = { email: "", canUpload: false, isAdmin: false };
const resource = {
  id, status: "pending", uploader_email: "uploader@test", storage_path: `${id}/file.pptx`,
  size_bytes: 1024, mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
const stubs = (server, storage = {}) => ({
  "next/server": { NextResponse: { json, redirect: (url, options = {}) => ({ url, status: options.status || 302 }) } },
  "@/lib/supabaseServer": { SupabaseConfigError: class extends Error {}, SupabaseRequestError: class extends Error {} },
  "@/lib/eccResources/server": server,
  "@/lib/eccResources/storage": storage,
  "@/lib/eccResources/model": { canPreviewResource: () => false }
});

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
