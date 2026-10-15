import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, language) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`)((name) => {
    if (name === "@/components/LanguageProvider") return { useLanguage: () => ({ language }) };
    if (name === "@/lib/woohyukmon/progress") return load("src/lib/woohyukmon/progress.ts", language);
    return require(name);
  }, module, module.exports);
  return module.exports;
}

test("only one simple progress line is rendered and it disappears when inactive", () => {
  for (const language of ["ko", "en"]) {
    const { AssistantProgress } = load("src/components/AssistantProgress.tsx", language);
    assert.equal(renderToStaticMarkup(React.createElement(AssistantProgress, { active: false, stage: "writing" })), "");
    const html = renderToStaticMarkup(React.createElement(AssistantProgress, { active: true, stage: "site_sources_started" }));
    assert.equal((html.match(/role="status"/g) || []).length, 1);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /aria-atomic="true"/);
    assert.match(html, /K_LINE/);
    assert.doesNotMatch(html, /rounded|border|truncate|<details|<button|\bOpenAI\b|\bNVIDIA\b/);
  }
});

test("both chat surfaces reuse progress without duplicate placeholder copy or technical badges", () => {
  const global = readFileSync("src/components/GlobalWoohyukmon.tsx", "utf8");
  const full = readFileSync("src/components/WoohyukmonChatbot.tsx", "utf8");
  assert.equal((global.match(/<AssistantProgress /g) || []).length, 1);
  assert.equal((full.match(/<AssistantProgress /g) || []).length, 1);
  assert.doesNotMatch(global, />\s*처리 중\s*</);
  assert.doesNotMatch(full, /검색하고 답변을 준비하고 있어요\.|buildCompactStatus\(message, language\)/);
  assert.match(global, /visibleProgressStage\(current, event.status\)/);
  assert.match(full, /visibleProgressStage\(message.progressStage/);
  assert.match(global, /setProgressStage\("writing"\)/);
  assert.match(full, /progressStage: "writing"/);
  assert.doesNotMatch(global + full, /chain.of.thought|reasoning_content|reasoning\.delta/i);
});

test("site-source progress is sent before the real authorized retrieval, not as fabricated reasoning", () => {
  const route = readFileSync("src/app/api/gemini/route.ts", "utf8");
  assert.ok(route.indexOf('status: "site_sources_started"') < route.indexOf('await loadSiteEvidence(await getClubAssistantAccess()'));
  assert.match(route, /if \(retrieveSiteEvidence\) controller.enqueue/);
});
