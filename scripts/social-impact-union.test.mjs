import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import QRCode from "qrcode";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
const url = "https://open.kakao.com/o/gOIWwoni";

function load(path, language = "en", developer = false) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process, URL, Headers })((name) => {
    if (name === "next-auth/jwt") return { getToken: () => { throw new Error("Guest page must not require a token"); } };
    if (name === "next/navigation") return { usePathname: () => "/social-impact-union" };
    if (name === "next-auth/react") return { useSession: () => ({ status: developer ? "authenticated" : "unauthenticated", data: developer ? { user: { name: "Developer Test Account" } } : null }) };
    if (name === "@/hooks/useSuperAdmin") return { useSuperAdmin: () => ({ isDeveloper: developer }) };
    if (name === "@/hooks/useEccAccess") return { useEccAccess: () => ({}) };
    if (name === "@/hooks/useHanhwalAccess") return { useHanhwalAccess: () => ({}) };
    if (name === "@/components/CartProvider") return { useCart: () => ({ totalQuantity: 0 }) };
    if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
    if (name === "@/components/LanguageProvider") return {
      I18nText: (copy) => copy[language], useLanguage: () => ({ language, pick: (copy) => copy[language] }), LanguageSwitcher: () => null
    };
    if (name.startsWith("@/")) {
      const suffix = name.startsWith("@/components/") ? ".tsx" : ".ts";
      return load(`src/${name.slice(2)}${suffix}`, language, developer);
    }
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test("SIU page is public, localized and contains only an introduction and exact open-chat link", async () => {
  for (const language of ["en", "ko"]) {
    const page = load("src/app/social-impact-union/page.tsx", language);
    const html = renderToStaticMarkup(await page.default());
    assert.match(html, /<h1[^>]*>Social Impact Union<\/h1>/);
    assert.match(html, /소셜임팩트유니온/);
    assert.match(html, language === "ko" ? /전주를 기반으로/ : /people and ideas in Jeonju/);
    assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), [url]);
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /focus-visible:outline/);
    assert.match(html, language === "ko" ? /새 탭에서 열림/ : /opens in a new tab/);
    assert.doesNotMatch(html, /<form|<input|Project JIT|Official Social Impact Union Logo|temporary/i);
  }
});

test("rendered QR is the local library PNG generated from the exact owner-supplied URL", async () => {
  const { default: page } = load("src/app/social-impact-union/page.tsx");
  const html = renderToStaticMarkup(await page());
  const src = html.match(/<img src="([^"]+)"/)[1];
  const expected = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 4, type: "image/png", width: 720 });
  assert.equal(src, expected);
  assert.match(html, /alt="Social Impact Union Kakao Open Chat QR Code"/);
  assert.match(html, /width="720" height="720"/);
  assert.match(src, /^data:image\/png;base64,/);
});

test("SIU and existing home cards share the exact responsive wrapper, with preserved destinations", () => {
  for (const language of ["en", "ko"]) {
    const { HomeTrackSections } = load("src/components/HomeTrackSections.tsx", language);
    const html = renderToStaticMarkup(React.createElement(HomeTrackSections));
    const cards = [...html.matchAll(/<a href="([^"]+)" class="([^"]+)"/g)];
    assert.deepEqual(cards.map((card) => card[1]), ["/our-activities/ecc", "/our-activities/hanhwal", "/social-impact-union", "/jeju"]);
    assert.equal(new Set(cards.map((card) => card[2])).size, 1);
    assert.match(html, /md:grid-cols-2 xl:grid-cols-4/);
    assert.match(html, /grid-cols-\[44px_minmax\(0,1fr\)_20px\]/);
  }
});

test("temporary mark stays separate from official club marks and browser metadata", () => {
  const { SocialImpactUnionMark } = load("src/components/social-impact-union/SocialImpactUnionMark.tsx");
  const html = renderToStaticMarkup(React.createElement(SocialImpactUnionMark));
  assert.equal((html.match(/<circle /g) ?? []).length, 3);
  assert.match(html, /viewBox="0 0 64 64"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<image|<text|gradient|official/i);
  assert.doesNotMatch(readFileSync("src/components/ClubMark.tsx", "utf8"), /social-impact|siu/i);
  for (const path of ["src/app/manifest.ts", "src/app/layout.tsx"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /SocialImpactUnionMark/);
  }
});

test("SIU metadata is public and navigation is not added to the student club registry", () => {
  const { metadata } = load("src/app/social-impact-union/page.tsx");
  assert.equal(metadata.title, "Social Impact Union");
  assert.equal(metadata.robots.index, true);
  assert.ok(metadata.alternates.canonical.endsWith("/social-impact-union"));
  assert.doesNotMatch(readFileSync("src/data/activityBoards.ts", "utf8"), /social-impact|siu/i);
  const nav = readFileSync("src/components/Navbar.tsx", "utf8");
  assert.doesNotMatch(nav, /socialImpactUnion|social-impact-union|Social Impact Union/);
  assert.match(nav, /\{isDeveloper \? \(\s*<Link\s*href="\/developer"/);
});

test("anonymous SIU access does not open any existing protected page or a future SIU subpage", async () => {
  const { middleware } = load("src/middleware.ts");
  assert.equal((await middleware(new NextRequest("https://kline.test/social-impact-union"))).status, 200);
  for (const path of ["/ecc-join", "/ecc-official", "/hanhwal-join", "/hanhwal-official", "/developer", "/jeju", "/v4", "/social-impact-union/admin"]) {
    const result = await middleware(new NextRequest(`https://kline.test${path}`));
    assert.equal(result.status, 307, path);
    assert.equal(new URL(result.headers.get("location")).pathname, "/login", path);
  }
});

test("desktop navigation excludes SIU while preserving other destinations and conditional controls", () => {
  for (const language of ["en", "ko"]) {
    for (const developer of [false, true]) {
      const { Navbar } = load("src/components/Navbar.tsx", language, developer);
      const html = renderToStaticMarkup(React.createElement(Navbar));
      assert.match(html, /hidden min-w-0 flex-wrap items-center justify-center/);
      assert.match(html, /flex min-w-0 shrink-0 items-center gap-1/);
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      for (const path of ["/", "/our-activities", "/our-activities/ecc", "/our-activities/hanhwal", "/jeju"]) assert.ok(links.includes(path));
      assert.equal(links.includes("/developer"), developer);
      assert.equal(links.includes("/cart"), developer);
      assert.equal(links.filter((path) => path === "/social-impact-union").length, 0);
    }
  }
});
