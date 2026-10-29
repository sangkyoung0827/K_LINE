import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync("src/components/MobileNavigationMenu.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${code}\n})`)((name) => {
  if (name === "next/link") return { default: ({ children, ...props }) => React.createElement("a", props, children) };
  if (name === "@/components/ClubMark") return { ClubMark: () => React.createElement("span", { "aria-hidden": true }) };
  if (name === "@/components/WoohyukmonGlassesIcon") return { WoohyukmonGlassesIcon: () => React.createElement("span", { "aria-hidden": true }) };
  if (name === "@/components/WoohyukmonLauncher") return { WoohyukmonLauncher: ({ children, ...props }) => React.createElement("button", { type: "button", "aria-haspopup": "dialog", ...props }, children) };
  if (name === "@/data/socialImpactUnion") return { socialImpactUnion: { path: "/social-impact-union" } };
  return require(name);
}, module, module.exports);
const { MobileNavigationMenu } = module.exports;
const guest = { isLoggedIn: false, isOfficialMember: false, isAdmin: false, isSuperAdmin: false };
const member = { ...guest, isLoggedIn: true, isOfficialMember: true };
const admin = { ...member, isAdmin: true };
const render = (eccAccess = guest, hanhwalAccess = guest, language = "en") => renderToStaticMarkup(
  React.createElement(MobileNavigationMenu, { language, eccAccess, hanhwalAccess, onNavigate() {} })
);
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

test("mobile menu replaces Journey profile with Woohyukmon and keeps two initially collapsed club groups", () => {
  const html = render();
  assert.equal((html.match(/<details /g) ?? []).length, 2);
  assert.equal((html.match(/<summary /g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen=/);
  assert.deepEqual(hrefs(html), ["/our-activities/ecc", "/our-activities/hanhwal", "/social-impact-union"]);
  assert.match(html, /Social Impact Union/);
  assert.ok(html.lastIndexOf("</details>") < html.indexOf('href="/social-impact-union"'));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Woohyukmon/);
  assert.doesNotMatch(html, /\/jeju/);
  assert.doesNotMatch(html, /International Student Club|Login \/ Profile|\/cart|\/developer/);
});

test("registration links stay within the corresponding club for logged-in nonmembers", () => {
  const html = render({ ...guest, isLoggedIn: true }, member);
  assert.ok(hrefs(html).includes("/ecc-join"));
  assert.ok(!hrefs(html).includes("/hanhwal-join"));
  assert.ok(!hrefs(html).includes("/ecc-official"));
  assert.ok(hrefs(html).includes("/hanhwal-official"));
});

test("members see official, activity and resource links without administrative links", () => {
  const links = hrefs(render(member, member));
  for (const href of ["/ecc-official", "/our-activities/ecc/activity", "/our-activities/ecc/resources",
    "/hanhwal-official", "/our-activities/hanhwal/activity", "/our-activities/hanhwal/free-board"]) assert.ok(links.includes(href));
  assert.ok(!links.some((href) => /\/(members|fund|operations)$/.test(href)));
});

test("club administrative access remains separate and preserves existing fund visibility", () => {
  const eccOnly = hrefs(render(admin, member));
  assert.ok(eccOnly.includes("/our-activities/ecc/members"));
  assert.ok(eccOnly.includes("/our-activities/ecc/fund"));
  assert.ok(eccOnly.includes("/our-activities/ecc/operations"));
  assert.ok(!eccOnly.includes("/our-activities/hanhwal/members"));
  const hanhwalOnly = hrefs(render(member, admin));
  assert.ok(hanhwalOnly.includes("/our-activities/hanhwal/members"));
  assert.ok(hanhwalOnly.includes("/our-activities/hanhwal/operations"));
  assert.ok(!hanhwalOnly.includes("/our-activities/hanhwal/fund"));
  assert.ok(!hanhwalOnly.includes("/our-activities/ecc/members"));
  assert.ok(hrefs(render(member, { ...admin, isSuperAdmin: true })).includes("/our-activities/hanhwal/fund"));
});

test("Korean labels use the same routes and expose Woohyukmon for guests and members", () => {
  assert.deepEqual(hrefs(render(member, member, "ko")), hrefs(render(member, member)));
  for (const role of [guest, member, admin]) assert.match(render(role, role, "ko"), /우혁몬/);
  assert.match(render(member, member, "ko"), /활동 신청/);
});

function renderLayout(pathname, role) {
  const layoutCode = ts.transpileModule(readFileSync("src/components/Layout.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const layoutModule = { exports: {} };
  const chrome = ["Navbar", "Footer", "MobileBottomNav", "ReadOnlyDeveloperNotice", "ActivityRatingModal", "GlobalWoohyukmonGate"];
  vm.runInNewContext(`(function(require,module,exports){${layoutCode}\n})`)((name) => {
    if (name === "next/navigation") return { usePathname: () => pathname };
    const component = chrome.find((item) => name === `@/components/${item}`);
    if (component) return { [component]: () => React.createElement("div", { "data-site-chrome": component, "data-role": role }) };
    return require(name);
  }, layoutModule, layoutModule.exports);
  return renderToStaticMarkup(React.createElement(layoutModule.exports.Layout, null,
    React.createElement("div", { "data-page-content": true }, role)
  ));
}

test("Hanhwal join hides all global site chrome for every role while preserving page content", () => {
  for (const role of ["guest", "member", "official_member", "admin", "super_admin", "developer", "read_only_developer"]) {
    const html = renderLayout("/hanhwal-join", role);
    assert.doesNotMatch(html, /data-site-chrome|mobile-app-shell/);
    assert.match(html, /data-page-content/);
    assert.ok(html.includes(role));
  }
});

test("Hanhwal public pages stay standalone and all other pages retain global navigation", () => {
  for (const pathname of ["/our-activities/hanhwal", "/our-activities/hanhwal/gallery", "/our-activities/hanhwal/solbam", "/our-activities/hanhwal/activities"]) {
    assert.doesNotMatch(renderLayout(pathname, "member"), /data-site-chrome/);
  }
  for (const pathname of ["/", "/ecc-join", "/hanhwal-official", "/our-activities/hanhwal/members", "/our-activities/hanhwal/resources", "/co-development"]) {
    const html = renderLayout(pathname, "admin");
    for (const component of ["Navbar", "Footer", "MobileBottomNav"]) {
      assert.ok(html.includes(`data-site-chrome="${component}"`), `${pathname}: ${component}`);
    }
  }
});
