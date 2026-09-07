import assert from "node:assert/strict";
import test from "node:test";
import { shouldSubmitPrompt } from "../../components/WoohyukmonPromptInput";

test("composer preserves Enter send and Shift+Enter newline", () => {
  const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };
  assert.equal(shouldSubmitPrompt(enter), true);
  assert.equal(shouldSubmitPrompt({ ...enter, shiftKey: true }), false);
  assert.equal(shouldSubmitPrompt({ ...enter, key: "a", keyCode: 65 }), false);
});

test("Korean IME confirmation cannot submit the prompt", () => {
  const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 };
  assert.equal(shouldSubmitPrompt({ ...enter, isComposing: true }), false);
  assert.equal(shouldSubmitPrompt({ ...enter, keyCode: 229 }), false);
});
