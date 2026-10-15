import assert from "node:assert/strict";
import { test } from "node:test";
import { assistantProgressText, visibleProgressStage } from "./progress";

test("progress is a brief localized description of an observed workflow phase", () => {
  assert.match(assistantProgressText("site_sources_started", "ko"), /K_LINE 자료/);
  assert.match(assistantProgressText("external_search_started", "en"), /searching/);
  assert.match(assistantProgressText("operation_confirmed", "ko"), /승인한 작업/);
  assert.notEqual(assistantProgressText("writing", "ko"), assistantProgressText("request_started", "ko"));
  assert.match(assistantProgressText("external_search_no_results", "ko"), /결과가 부족/);
});

test("unknown diagnostics and model/provider verification cannot replace a real workflow phase", () => {
  for (const diagnostic of [undefined, "heartbeat", "model_verified", "__proto__", "constructor", "toString", "OpenAI secret-sk-test", "arbitrary internal thought"]) {
    assert.equal(visibleProgressStage("writing", diagnostic), "writing");
    assert.equal(assistantProgressText(diagnostic, "ko"), "요청을 확인하고 있어요.");
  }
  assert.equal(visibleProgressStage("request_started", "site_sources_started"), "site_sources_started");
});

test("UI phases do not invent completed writes, private access or internal reasoning", () => {
  for (const language of ["ko", "en"] as const) {
    const beforeConfirmation = assistantProgressText("operation_started", language);
    assert.doesNotMatch(beforeConfirmation, /승인했|게시했|삭제했|published|deleted|approved/i);
    const context = assistantProgressText("site_sources_started", language);
    assert.doesNotMatch(context, /모든 테이블|private|all tables|chain.of.thought/i);
  }
});
