import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/data/")) return load(`src/${name.slice(2)}.ts`, mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

function mocks({ language = "ko", admin = false, readOnly = false } = {}) {
  return {
    "@/components/LanguageProvider": {
      useLanguage: () => ({ language }),
      I18nText: (copy) => copy[language]
    },
    "@/components/ReadOnlyDeveloperNotice": { useReadOnlyDeveloper: () => readOnly },
    "@/hooks/useEccAccess": { useEccAccess: () => ({ isAdmin: admin }) },
    "next/navigation": { usePathname: () => "/ecc-official" },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) }
  };
}

const cardProps = { initialPeriodLabel: "Test semester", initialTeamChatUrl: "https://example.test/team-chat", isAdmin: false };

test("team chat keeps its live destination while hiding the large intro and QR only below md", () => {
  for (const language of ["ko", "en"]) {
    const { EccOfficialTeamChatCard } = load("src/components/EccOfficialTeamChatCard.tsx", mocks({ language }));
    const html = renderToStaticMarkup(React.createElement(EccOfficialTeamChatCard, cardProps));
    assert.match(html, /href="https:\/\/example.test\/team-chat"/);
    assert.match(html, /target="_blank" rel="noreferrer"/);
    assert.match(html, /class="hidden max-w-2xl md:block"/);
    assert.match(html, /class="hidden aspect-square[^\"]*md:block"/);
    assert.match(html, /class="flex w-full items-center gap-3 md:mt-6 md:grid md:max-w-60"/);
    assert.match(html, /p-0 md:p-10/);
    assert.equal((html.match(/<a /g) || []).length, 1);
    assert.doesNotMatch(html, /<button/);
  }
});

test("mobile team chat editing remains admin-only and respects read-only developer access", () => {
  for (const [admin, readOnly] of [[false, false], [true, false], [true, true]]) {
    const { EccOfficialTeamChatCard } = load("src/components/EccOfficialTeamChatCard.tsx", mocks({ readOnly }));
    const html = renderToStaticMarkup(React.createElement(EccOfficialTeamChatCard, { ...cardProps, isAdmin: admin }));
    assert.equal(html.includes('aria-label="팀채팅 정보 수정"'), admin && !readOnly);
  }
  const { EccOfficialTeamChatCard } = load("src/components/EccOfficialTeamChatCard.tsx", mocks());
  const temporary = renderToStaticMarkup(React.createElement(EccOfficialTeamChatCard, { ...cardProps, temporaryEntry: true }));
  assert.doesNotMatch(temporary, /<img/);
  assert.match(temporary, /href="https:\/\/example.test\/team-chat"/);
});

test("registration description collapses only when explicitly opted in, never the registration status/form", () => {
  const { EccMemberRegistrationForm } = load("src/components/EccMemberRegistrationForm.tsx", mocks());
  const ordinary = renderToStaticMarkup(React.createElement(EccMemberRegistrationForm));
  assert.doesNotMatch(ordinary, /aria-expanded|hidden md:grid/);
  const official = renderToStaticMarkup(React.createElement(EccMemberRegistrationForm, { collapsibleMobileIntro: true }));
  assert.match(official, /aria-expanded="false"/);
  assert.match(official, /ECC 설명 및 등록 안내/);
  assert.match(official, /class="hidden md:grid gap-8"/);
  assert.ok(official.indexOf("Membership Fee") < official.indexOf("등록 상태를 불러오는 중"));
  assert.match(readFileSync("src/app/ecc-official/page.tsx", "utf8"), /<EccMemberRegistrationForm collapsibleMobileIntro \/>/);
  for (const path of ["src/app/ecc-join/page.tsx", "src/app/our-activities/ecc/register/page.tsx"]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /collapsibleMobileIntro/);
  }
});

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}

test("disclosure toggles without remounting or hiding the registration form and without network writes", () => {
  const states = [];
  let cursor = 0;
  const hooks = { ...React, useEffect: () => {}, useMemo: (fn) => fn(), useId: () => "ecc-intro-test",
    useState(initial) {
      const index = cursor++;
      // The component's third state is its initial registration loading flag.
      if (!(index in states)) states[index] = index === 2 ? false : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    }
  };
  const { EccMemberRegistrationForm } = load("src/components/EccMemberRegistrationForm.tsx", { ...mocks(), react: hooks });
  const render = () => { cursor = 0; return EccMemberRegistrationForm({ collapsibleMobileIntro: true }); };
  for (const expanded of [false, true, false]) {
    const tree = render();
    const all = nodes(tree);
    const toggle = all.find((node) => node.props?.["aria-controls"] === "ecc-intro-test");
    const intro = all.find((node) => node.props?.id === "ecc-intro-test");
    const form = all.find((node) => node.type === "form");
    assert.equal(toggle.props["aria-expanded"], expanded);
    assert.equal(intro.props.className.includes("hidden md:grid"), !expanded);
    assert.ok(form);
    assert.ok(!nodes(intro).includes(form));
    toggle.props.onClick();
  }
});
