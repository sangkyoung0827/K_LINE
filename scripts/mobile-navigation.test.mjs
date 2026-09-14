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

test("mobile menu contains Journey profile and two initially collapsed club groups", () => {
  const html = render();
  assert.equal((html.match(/<details /g) ?? []).length, 2);
  assert.equal((html.match(/<summary /g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\bopen=/);
  assert.deepEqual(hrefs(html), ["/jeju/profile", "/our-activities/ecc", "/our-activities/hanhwal", "/social-impact-union"]);
  assert.match(html, /Social Impact Union/);
  assert.ok(html.lastIndexOf("</details>") < html.indexOf('href="/social-impact-union"'));
  assert.match(html, /My Journey profile/);
  assert.doesNotMatch(html, /International Student Club|Login \/ Profile|\/cart|\/developer/);
});

test("registration links stay within the corresponding club for logged-in nonmembers", () => {
  const html = render({ ...guest, isLoggedIn: true }, member);
  assert.ok(hrefs(html).includes("/ecc-join"));
  assert.ok(!hrefs(html).includes("/hanhwal-join"));
  assert.ok(!hrefs(html).includes("/ecc-official"));
  assert.ok(hrefs(html).includes("/hanhwal-official"));
});

test("members see official, activity and board links without administrative links", () => {
  const links = hrefs(render(member, member));
  for (const club of ["ecc", "hanhwal"]) {
    for (const href of [`/${club}-official`, `/our-activities/${club}/activity`, `/our-activities/${club}/free-board`]) assert.ok(links.includes(href));
  }
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

test("Korean labels use the same routes and expose a clear Journey profile destination", () => {
  assert.deepEqual(hrefs(render(member, member, "ko")), hrefs(render(member, member)));
  assert.match(render(member, member, "ko"), /추억록 프로필 설정/);
  assert.match(render(member, member, "ko"), /활동 신청/);
});
