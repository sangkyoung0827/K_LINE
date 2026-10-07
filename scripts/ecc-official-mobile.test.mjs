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
    if (name === "@/components/EccRegistrationSummary") return load("src/components/EccRegistrationSummary.tsx", mocks);
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
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) }
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

test("submitted registration is compact only on mobile and keeps every detail mounted", () => {
  for (const language of ["ko", "en"]) {
    const { EccRegistrationSummary } = load("src/components/EccRegistrationSummary.tsx", mocks({ language }));
    const html = renderToStaticMarkup(React.createElement(EccRegistrationSummary, {
      status: language === "ko" ? "정식회원 승인 완료" : "Official member approved",
      description: "Existing approval information", avatarUrl: "https://example.test/avatar.png"
    }, React.createElement("dl", null, React.createElement("dd", null, "Existing member details"))));
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /md:hidden/);
    assert.match(html, /hidden flex-wrap[^\"]*md:flex/);
    assert.match(html, /class="hidden md:block"/);
    assert.match(html, /Existing member details/);
    assert.match(html, /Existing approval information/);
    assert.match(html, /src="https:\/\/example.test\/avatar.png"/);
    assert.equal((html.match(/<button /g) || []).length, 1);
  }
});

test("registration disclosure toggles locally without changing payment or approval data", () => {
  let expanded = false;
  const hooks = { ...React, useId: () => "registration-details", useState: () => [expanded, setter => { expanded = setter(expanded); }] };
  const { EccRegistrationSummary } = load("src/components/EccRegistrationSummary.tsx", { ...mocks(), react: hooks });
  const props = { status: "회비 확인 대기 중", description: "Original status", avatarUrl: "", children: React.createElement("dd", null, "Original data") };
  for (const state of [false, true, false]) {
    const tree = EccRegistrationSummary(props), all = nodes(tree);
    const button = all.find(node => node.props?.["aria-controls"] === "registration-details");
    const details = all.find(node => node.props?.id === "registration-details");
    assert.equal(button.props["aria-expanded"], state);
    assert.equal(details.props.className, state ? "block" : "hidden md:block");
    assert.equal(props.status, "회비 확인 대기 중");
    assert.ok(nodes(details).some(node => node.type === "dd"));
    button.props.onClick();
  }
  const source = readFileSync("src/components/EccRegistrationSummary.tsx", "utf8");
  assert.doesNotMatch(source, /fetch\(|localStorage|paymentConfirmed|officialMember/);
});

test("registered member fields and original edit/official actions are preserved", () => {
  for (const approved of [false, true]) {
    const registration = { id: "local-test", fullName: "Local Test Member", studentId: "20260001", departmentOrMajor: "Culture", nationality: "Test", gender: "Other", kakaoDisplayName: "Local", kakaoId: "local-test", googleEmail: "very-long-test-member-address@example.test", googleName: "Local", googleAvatarUrl: "", paymentConfirmed: approved, officialMember: approved, status: approved ? "approved" : "submitted", adminNote: "Existing admin note" };
    let cursor = 0;
    const hooks = { ...React, useEffect: () => {}, useMemo: fn => fn(), useId: () => "test-summary", useState: initial => {
      const index = cursor++;
      return [index === 0 ? registration : index === 2 ? false : initial, () => { throw Error("Unexpected mutation"); }];
    } };
    const { EccMemberRegistrationForm } = load("src/components/EccMemberRegistrationForm.tsx", { ...mocks(), react: hooks });
    const tree = EccMemberRegistrationForm({}), all = nodes(tree);
    const summary = all.find(node => node.type?.name === "EccRegistrationSummary");
    assert.ok(summary);
    const html = renderToStaticMarkup(React.createElement("div", null, summary.props.children));
    for (const value of [registration.fullName, registration.studentId, registration.googleEmail, registration.kakaoId, registration.adminNote]) assert.ok(html.includes(value));
    assert.match(html, /overflow-wrap:anywhere/);
    assert.match(html, /md:grid-cols-2/);
    if (approved) { assert.match(html, /href="\/ecc-official"/); assert.match(html, /정식회원 승인 완료/); }
    else { assert.match(html, /등록 정보 수정/); assert.match(html, /회비 확인 대기 중/); }
    assert.equal(registration.paymentConfirmed, approved);
    assert.equal(registration.officialMember, approved);
  }
});
