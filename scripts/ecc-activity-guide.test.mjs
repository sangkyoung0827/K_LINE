import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { AbortSignal, Date })((name) => {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}${name.startsWith("@/components/") ? ".tsx" : ".ts"}`, mocks);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test("activity access is read-only for members, scoped to ECC applications and never grants anonymous/admin access", () => {
  const { activityGuideAccess } = load("src/lib/woohyukmon/activity-guide-access.ts");
  for (const path of ["/", "/developer", "/our-activities/hanhwal/activity", "/our-activities/ecc/activity"]) {
    const member = activityGuideAccess(path, { email: "member@test", isLoggedIn: true });
    assert.equal(member.visible, path === "/our-activities/ecc/activity");
    assert.equal(member.readOnly, true);
    assert.equal(activityGuideAccess(path, {}).visible, false);
    const admin = activityGuideAccess(path, { email: "admin@test", isLoggedIn: true, isAdmin: true });
    assert.equal(admin.visible, true);
    assert.equal(admin.readOnly, false);
  }
});

test("notice grounding retains processes, source dates and historical limits without private accounts", async () => {
  const paths = [];
  const { buildEccActivityGuide } = load("src/lib/ecc/activity-guide.ts", { "@/lib/supabaseServer": {
    supabaseRequest: async (path, init) => {
      paths.push(path);
      assert.equal(init.cache, "no-store");
      assert.ok(init.signal);
      assert.equal(init.method, undefined);
      if (path.includes("gathering_open_days")) return [{ gathering_open_days: ["monday"] }];
      if (path.includes("ecc_registration_content")) return [{ body: JSON.stringify([{ id: "gathering", titleKo: "게더링", descriptionEn: "Current description", archived: false }, { id: "hidden", titleEn: "Archived notice", archived: true }]) }];
      return [{ activity_id: "opening", is_open: false, registration_closed_at: "2026-09-10T04:45:30Z", updated_by: "private@test" }];
    }
  } });
  const text = await buildEccActivityGuide("게더링 진행 방식은?", false, new Date("2026-09-14T15:01:00Z"));
  for (const pattern of [/2026-09-15/, /one day before/, /group leader/, /same-day/, /own activity costs/, /SEPARATE from membership/, /before the current date/, /NOT an ECC event/, /Current description/, /"applicationOpen":false/, /\["monday"\]/]) assert.match(text, pattern);
  assert.doesNotMatch(text, /private@test|Archived notice|3333-30|invite\.kakao/);
  assert.equal(paths.length, 3);
  assert.ok(paths.every((path) => !/applications|roles|members/.test(path)));
});

test("failed/empty live reads never become open defaults or fabricated weekdays", async () => {
  for (const response of [null, []]) {
    const { buildEccActivityGuide } = load("src/lib/ecc/activity-guide.ts", { "@/lib/supabaseServer": {
      supabaseRequest: async () => { if (response === null) throw new Error("unavailable"); return response; }
    } });
    const text = await buildEccActivityGuide("어디서 만나?", true);
    assert.match(text, /UNKNOWN, never default-open/);
    assert.match(text, /weekdays (?:are unverified|could not be verified)/);
    assert.doesNotMatch(text, /"applicationOpen":true/);
  }
});

test("ECC notices do not leak into Hanhwal or unrelated questions", async () => {
  const { buildEccActivityGuide, isEccActivityQuestion } = load("src/lib/ecc/activity-guide.ts", { "@/lib/supabaseServer": {
    supabaseRequest: async () => { throw new Error("Must not query"); }
  } });
  assert.equal(await buildEccActivityGuide("한활 활동 방식", true), "");
  assert.equal(await buildEccActivityGuide("Tell me about Hanhwal", true), "");
  assert.equal(await buildEccActivityGuide("오늘 날씨"), "");
  assert.equal(isEccActivityQuestion("Where should we meet?", true), true);
});

function widget(language, activityGuide, readOnly = true) {
  return load("src/components/GlobalWoohyukmon.tsx", {
    "@/components/LanguageProvider": { useLanguage: () => ({ pick: (copy) => copy[language] }) },
    "@/hooks/useConversationMemory": { useConversationMemory: () => ({ enabled: false }) },
    "@/hooks/useSavedConversation": { useSavedConversation: () => ({ save: async () => {} }) }
  }).GlobalWoohyukmon;
}

test("activity launcher displays exact localized bubble left of unchanged glasses, and not on other pages", () => {
  for (const language of ["ko", "en"]) {
    for (const activityGuide of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(widget(language), { actorRole: "member", actorEmail: "member@test", activityGuide, readOnly: true }));
      const copy = language === "ko" ? "활동에 관련된 질문을 무엇이든 물어보세요" : "Ask me anything about activities.";
      assert.equal(html.includes(copy), activityGuide);
      assert.match(html, /Woohyukmon glasses icon/);
      assert.match(html, /max-w-\[calc\(100vw-2rem\)\]/);
      if (activityGuide) {
        assert.ok(html.indexOf(copy) < html.indexOf('aria-label="Open Global Woohyukmon"'));
        assert.match(html, /env\(safe-area-inset-bottom\)/);
      }
    }
  }
});

test("member guide bypasses operations, guards confirmation, and keeps server authorization intact", () => {
  const widget = readFileSync("src/components/GlobalWoohyukmon.tsx", "utf8");
  assert.match(widget, /if \(readOnly\) return \{ handled: false \} as const;/);
  assert.match(widget, /if \(busy \|\| readOnly\) return;/);
  assert.match(widget, /!readOnly && message.operation\?\.kind === "confirmation"/);
  assert.match(widget, /activityGuide: activityGuide \? "ecc" : undefined/);
  const gate = readFileSync("src/components/GlobalWoohyukmonGate.tsx", "utf8");
  assert.match(gate, /actorEmail.toLowerCase\(\) !== sessionEmail.toLowerCase\(\)/);
  assert.match(gate, /\[pathname, sessionEmail, status\]/);
  const operations = readFileSync("src/app/api/woohyukmon/operations/route.ts", "utf8");
  assert.match(operations, /!access.isAdmin \|\| !access.email/);
  const route = readFileSync("src/app/api/gemini/route.ts", "utf8");
  assert.match(route, /buildEccActivityGuide\(query, body.activityGuide === "ecc"\)/);
  assert.match(route, /eccAnnouncementContext,\s*eccActivityGuide,/);
  assert.match(route, /"ECC Official Activity Notices"/);
});
