import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
const root = process.cwd();
const nativeRequire = createRequire(import.meta.url);

function loader(stubs = {}, globals = {}) {
  const cache = new Map();
  function load(path) {
    const full = resolve(root, path);
    if (cache.has(full)) return cache.get(full).exports;
    const module = { exports: {} };
    cache.set(full, module);
    const code = ts.transpileModule(readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const require = (id) => {
      if (Object.hasOwn(stubs, id)) return stubs[id];
      if (id === "server-only") return {};
      if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`);
      if (id.startsWith(".")) return load(resolve(dirname(full), `${id}.ts`));
      return nativeRequire(id);
    };
    vm.runInNewContext(
      `(function(require,module,exports){${code}\n})`,
      {
        Buffer,
        URL,
        TextEncoder,
        Request,
        Response,
        Headers,
        File,
        AbortSignal,
        crypto: globalThis.crypto,
        console,
        process,
        fetch: globalThis.fetch,
        ...globals,
      },
      { filename: full },
    )(require, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const { validateDocument, safeLink } = load("src/lib/club-page/validation.ts");
const { newSection, THEME_PRESETS } = load("src/lib/club-page/config.ts");
const { validateImage, normalizeImage } = load("src/lib/club-page/media.ts");
const empty = () => ({ themeId: "default", sections: [] });
const all = () => ({
  themeId: "default",
  sections: [
    "hero",
    "about",
    "gallery",
    "schedule",
    "members",
    "recruit",
    "links",
  ].map((type) => newSection(type, "ecc")),
});

test("seven strict block types and exactly four themes; order remains unchanged", () => {
  const doc = all();
  doc.sections.reverse();
  assert.equal(validateDocument(doc, "ecc").sections[0].type, "links");
  for (const theme of THEME_PRESETS)
    assert.equal(
      validateDocument({ ...doc, themeId: theme.id }, "ecc").themeId,
      theme.id,
    );
  assert.equal(THEME_PRESETS.length, 4);
  assert.throws(() => validateDocument({ ...doc, themeId: "custom" }, "ecc"));
});
test("reject malformed, duplicate IDs, unknown fields, excessive arrays/text/payload", () => {
  const doc = all();
  for (const bad of [
    null,
    {},
    { ...doc, css: "" },
    { ...doc, sections: [doc.sections[0], doc.sections[0]] },
    {
      ...doc,
      sections: [
        { ...doc.sections[0], data: { ...doc.sections[0].data, html: "" } },
      ],
    },
    {
      ...doc,
      sections: Array.from({ length: 31 }, () => newSection("hero", "ecc")),
    },
    { ...doc, sections: [{ id: "x", type: "__proto__", data: {} }] },
  ])
    assert.throws(() => validateDocument(bad, "ecc"));
  const about = newSection("about", "ecc");
  about.data.body = "a".repeat(5001);
  assert.throws(() =>
    validateDocument({ ...empty(), sections: [about] }, "ecc"),
  );
  const gallery = newSection("gallery", "ecc");
  gallery.data.images = Array.from({ length: 25 }, () => ({
    imageUrl: "",
    caption: "",
  }));
  assert.throws(() =>
    validateDocument({ ...empty(), sections: [gallery] }, "ecc"),
  );
});
test("safe link allowlist rejects executable schemes, protocol-relative paths and private invites", () => {
  for (const url of [
    "/ecc-join",
    "/hanhwal-join",
    "https://example.com",
    "http://example.com",
    "https://open.kakao.com/o/public",
  ])
    assert.equal(safeLink(url), url);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,a",
    "vbscript:foo",
    "//evil.test",
    "/\\evil.test",
    "https://user:pass@site.test",
    "\nhttps://site.test",
    "https://invite.kakao.com/tc/private",
  ])
    assert.throws(() => safeLink(url));
});
test("image URLs stay in controlled club-specific bucket, never base64 or external tracking hosts", () => {
  const doc = all();
  const image =
    "https://project.supabase.co/storage/v1/object/public/club-page-media/ecc/11111111-1111-4111-8111-111111111111.png";
  doc.sections[0].data.imageUrl = image;
  assert.doesNotThrow(() =>
    validateDocument(doc, "ecc", "https://project.supabase.co"),
  );
  for (const url of [
    "data:image/png;base64,aa",
    image.replace("ecc/", "hanhwal/"),
    image.replace("project.supabase.co", "evil.test"),
    `${image}?tracking=1`,
    "https://project.supabase.co/other.png",
  ]) {
    doc.sections[0].data.imageUrl = url;
    assert.throws(() =>
      validateDocument(doc, "ecc", "https://project.supabase.co"),
    );
  }
});
test("HTML-like text stays plain text and never enters an HTML/markdown renderer", () => {
  const doc = all();
  doc.sections[1].data.body =
    '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  assert.equal(
    validateDocument(doc, "ecc").sections[1].data.body,
    doc.sections[1].data.body,
  );
  for (const path of [
    "renderers/Sections.tsx",
    "ClubWebsiteRenderer.tsx",
    "ClubWebsiteEditor.tsx",
  ])
    assert.doesNotMatch(
      readFileSync(resolve(root, `src/components/club-page/${path}`), "utf8"),
      /dangerouslySetInnerHTML|react-markdown|innerHTML\s*=/,
    );
});
test("media validates type, magic bytes, extension and bounded size", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  assert.equal(validateImage(png, "image/png", "photo.png"), "png");
  assert.throws(() => validateImage(png, "image/jpeg", "photo.jpg"));
  assert.throws(() => validateImage(png, "image/png", "file.svg"));
  assert.throws(() =>
    validateImage(Buffer.from("<svg>test</svg>"), "image/png", "file.png"),
  );
  assert.throws(() =>
    validateImage(
      Buffer.concat([png, Buffer.alloc(4_000_000)]),
      "image/png",
      "photo.png",
    ),
  );
});

test("uploaded images decode and re-encode; corrupt files never reach storage", async () => {
  const sharp = nativeRequire("sharp");
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#2563eb" },
  })
    .png()
    .toBuffer();
  const result = await normalizeImage(png, "image/png", "photo.png");
  assert.equal(result.extension, "png");
  assert.equal((await sharp(result.bytes).metadata()).width, 32);
  await assert.rejects(() =>
    normalizeImage(png.subarray(0, 16), "image/png", "photo.png"),
  );
});
function apiHarness(role = "user", allowedClub = "ecc", fetchMock) {
  let calls = [];
  let row = {
    draft_theme_id: "default",
    draft_sections: [],
    revision: 0,
    is_published: false,
    published_theme_id: null,
    published_sections: null,
  };
  class SupabaseRequestError extends Error {}
  const access = (club) => async () => ({
    email: role === "guest" ? "" : "fixture@example.test",
    isLoggedIn: role !== "guest",
    isAdmin:
      role === "developer" ||
      (club === allowedClub && ["admin", "super_admin"].includes(role)),
  });
  const localLoad = loader(
    {
      "@/lib/eccAccess": { getCurrentEccAccess: access("ecc") },
      "@/lib/hanhwalAccess": { getCurrentHanhwalAccess: access("hanhwal") },
      "@/lib/supabaseServer": {
        getSupabaseConfig: () => ({
          url: "https://project.supabase.co",
          serviceRoleKey: "fixture-only",
        }),
        SupabaseRequestError,
        supabaseRequest: async (path, init = {}) => {
          calls.push(path);
          if (path.startsWith("rpc/")) {
            const body = JSON.parse(init.body);
            if (body.expected_revision !== row.revision)
              throw new SupabaseRequestError("CLUB_PAGE_CONFLICT");
            if (body.action !== "unpublish") {
              row.draft_theme_id = body.theme;
              row.draft_sections = body.sections;
            }
            if (body.action === "publish") {
              row.published_theme_id = body.theme;
              row.published_sections = structuredClone(body.sections);
              row.is_published = true;
            }
            if (body.action === "unpublish") row.is_published = false;
            return ++row.revision;
          }
          return path.includes("is_published=eq.true")
            ? row.is_published
              ? [
                  {
                    published_theme_id: row.published_theme_id,
                    published_sections: row.published_sections,
                  },
                ]
              : []
            : [row];
        },
      },
    },
    {
      fetch:
        fetchMock ||
        (async () => {
          throw new Error("Unexpected external request in test");
        }),
    },
  );
  const { handleClubRequest } = localLoad("src/lib/club-page/http.ts");
  return {
    calls,
    row,
    media: (club, form) =>
      handleClubRequest(
        new Request(`https://kline.test/api/club-pages/${club}/media`, {
          method: "POST",
          body: form,
        }),
        { params: Promise.resolve({ clubKey: club }) },
        "media",
      ),
    request: (action, club = "ecc", method = "GET", body, headers = {}) =>
      handleClubRequest(
        new Request(`https://kline.test/api/club-pages/${club}/${action}`, {
          method,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          headers,
        }),
        { params: Promise.resolve({ clubKey: club }) },
        action,
      ),
  };
}
test("every draft, write, publish, unpublish and media route denies guests and ordinary members", async () => {
  for (const role of ["guest", "user", "official_member"]) {
    const api = apiHarness(role);
    for (const club of ["ecc", "hanhwal"])
      for (const [action, method] of [
        ["draft", "GET"],
        ["draft", "PUT"],
        ["publish", "POST"],
        ["unpublish", "POST"],
        ["media", "POST"],
      ]) {
        const response = await api.request(
          action,
          club,
          method,
          method === "GET" ? undefined : { document: empty(), revision: 0 },
        );
        assert.equal(response.status, role === "guest" ? 401 : 403);
      }
    assert.equal(api.calls.length, 0);
  }
});
test("ECC and Hanhwal editors stay isolated; higher ranks reuse existing club access", async () => {
  for (const role of ["admin", "super_admin", "developer"])
    for (const club of ["ecc", "hanhwal"]) {
      const api = apiHarness(role, club);
      assert.equal((await api.request("draft", club)).status, 200);
      assert.equal(
        (await api.request("draft", club === "ecc" ? "hanhwal" : "ecc")).status,
        role === "developer" ? 200 : 403,
      );
    }
});
test("save, publish, later draft and unpublish preserve distinct snapshots; no private public metadata", async () => {
  const api = apiHarness("admin");
  const first = all();
  assert.equal(
    (await api.request("draft", "ecc", "PUT", { document: first, revision: 0 }))
      .status,
    200,
  );
  assert.deepEqual(await (await api.request("published")).json(), {
    page: null,
  });
  assert.equal(
    (
      await api.request("publish", "ecc", "POST", {
        document: first,
        revision: 1,
      })
    ).status,
    200,
  );
  const later = empty();
  assert.equal(
    (await api.request("draft", "ecc", "PUT", { document: later, revision: 2 }))
      .status,
    200,
  );
  const result = await (await api.request("published")).json();
  assert.equal(result.page.sections.length, 7);
  assert.deepEqual(Object.keys(result.page).sort(), ["sections", "themeId"]);
  assert.equal(
    (await api.request("draft", "ecc", "PUT", { document: later, revision: 0 }))
      .status,
    409,
  );
  assert.equal(
    (
      await api.request("unpublish", "ecc", "POST", {
        document: later,
        revision: 3,
      })
    ).status,
    200,
  );
  assert.deepEqual(await (await api.request("published")).json(), {
    page: null,
  });
  assert.equal(api.row.published_sections.length, 7);
  assert.ok(
    api.calls.every(
      (path) =>
        path.startsWith("club_pages?") || path === "rpc/write_club_page",
    ),
  );
});
test("reject cross-origin writes, invalid club and excessive bodies before mutation", async () => {
  const api = apiHarness("developer");
  assert.equal((await api.request("draft", "unknown")).status, 404);
  assert.equal(
    (await api.request("publish", "ecc", "POST", { document: empty(), revision: 0 })).status,
    400,
  );
  assert.equal(
    (
      await api.request(
        "publish",
        "ecc",
        "POST",
        { document: empty(), revision: 0 },
        { origin: "https://evil.test" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await api.request("draft", "ecc", "PUT", "x".repeat(310_000))).status,
    413,
  );
  assert.equal(
    (
      await api.request("draft", "ecc", "PUT", {
        document: { ...empty(), javascript: "foo" },
        revision: 0,
      })
    ).status,
    400,
  );
  assert.equal(api.calls.length, 0);
});
test("public published lookup never queries roles, memberships or draft columns", async () => {
  const api = apiHarness("guest");
  assert.equal((await api.request("published")).status, 200);
  assert.equal(api.calls.length, 1);
  assert.match(api.calls[0], /select=published_theme_id,published_sections/);
  assert.doesNotMatch(api.calls[0], /draft|updated_by|roles|members/);
});
test("authorized media goes to the selected club bucket and response never contains secrets", async () => {
  const uploads = [];
  const api = apiHarness("admin", "hanhwal", async (url, init) => {
    uploads.push({ url, init });
    return new Response("{}", { status: 200 });
  });
  const sharp = nativeRequire("sharp");
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.set("file", new File([png], "test.png", { type: "image/png" }));
  const response = await api.media("hanhwal", form);
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.url, /\/club-page-media\/hanhwal\/[a-f0-9-]+\.png$/);
  assert.deepEqual(Object.keys(result), ["url"]);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].init.headers["x-upsert"], "false");
  const bad = new FormData();
  bad.set(
    "file",
    new File(["<svg>bad</svg>"], "test.png", { type: "image/png" }),
  );
  assert.equal((await api.media("hanhwal", bad)).status, 400);
  assert.equal(uploads.length, 1);
});
