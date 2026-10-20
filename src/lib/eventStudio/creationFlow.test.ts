import assert from "node:assert/strict";
import { test } from "node:test";
import type { StudioPreview } from "@/components/google-forms/EventStudio";
import { completeEventFlow, matchingCreationIntent } from "./creationFlow";

const draft = { job: { id: "job", revision: 2, state: "draft", club_key: "personal" }, token: "signed-token", missing: [], creationSupported: true } as unknown as StudioPreview;
test("one explicit action completes form and notice; a new approval is bound to the same revision", async () => {
  const calls: Record<string, unknown>[] = [], steps: string[] = [];
  const command = async <T>(body: object): Promise<T> => {
    calls.push(body as Record<string, unknown>);
    return ({ connection: { connected: true }, review: draft, approve: { ...draft, job: { ...draft.job, state: "notice_saved" }, applicationUrl: "https://example.test/form" } } as Record<string, unknown>)[(body as { action: string }).action] as T;
  };
  const result = await completeEventFlow(draft, command, s => steps.push(s));
  assert.equal(result.preview.job.state, "notice_saved");
  assert.deepEqual(calls.map(c => c.action), ["connection", "review", "approve"]);
  assert.equal(calls[2].confirmed, true);
  assert.equal(calls[2].token, "signed-token");
  assert.deepEqual(steps, ["connecting", "creating"]);
});
test("missing facts, unsupported adapter and completed jobs never create remotely", async () => {
  for (const preview of [{ ...draft, missing: ["location"] }, { ...draft, creationSupported: false }, { ...draft, job: { ...draft.job, state: "notice_saved" as const } }]) {
    await completeEventFlow(preview, async () => { throw new Error("must not call"); }, () => {});
  }
});
test("disconnected Google preserves the draft for OAuth rather than making a second plan", async () => {
  const result = await completeEventFlow(draft, async <T>() => ({ connected: false }) as T, () => {});
  assert.equal(result.needsConnection, true); assert.equal(result.preview, draft);
});
test("changed revision, running job, and provider failure cannot trigger a blind retry", async () => {
  const team = { ...draft, job: { ...draft.job, club_key: "ecc" as const } };
  await assert.rejects(completeEventFlow(team, async <T>() => ({ ...draft, job: { ...draft.job, revision: 3 } }) as T, () => {}), /JOB_CHANGED/);
  await assert.rejects(completeEventFlow({ ...draft, job: { ...draft.job, state: "running" } }, async () => { throw new Error("must not call"); }, () => {}), /JOB_RUNNING/);
  let calls = 0;
  await assert.rejects(completeEventFlow(team, async <T>(body: object) => { calls++; if ((body as { action: string }).action === "approve") throw new Error("NETWORK"); return draft as T; }, () => {}), /NETWORK/);
  assert.equal(calls, 2);
});
test("OAuth continuation requires this browser's unexpired intent for the exact job and revision", () => {
  const raw = JSON.stringify({ jobId: "job", revision: 2, expires: 1000 });
  assert.equal(matchingCreationIntent(raw, "job", 2, 999), true);
  assert.equal(matchingCreationIntent(raw, "other", 2, 999), false);
  assert.equal(matchingCreationIntent(raw, "job", 3, 999), false);
  assert.equal(matchingCreationIntent(raw, "job", 2, 1000), false);
  assert.equal(matchingCreationIntent("invalid", "job", 2), false);
});
