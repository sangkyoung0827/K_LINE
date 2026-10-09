import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseEvent,
  parseAnswers,
  parseQuestions,
  canReadMemory,
  canTransition,
  uuid,
} from "./model";
const event = {
  title: "New event",
  description: "",
  descriptionEn: "",
  startsAt: "2026-10-20T18:00:00+09:00",
  endsAt: "2026-10-20T20:00:00+09:00",
  location: "Room",
  online: false,
  capacity: 10,
  waitlist: true,
  approval: "automatic",
  applicationsOpenAt: "2026-10-01T00:00:00+09:00",
  applicationsCloseAt: "2026-10-19T23:59:00+09:00",
  visibility: "public",
  questions: [],
};
test("event parser preserves explicit timezone and rejects invalid date/capacity", () => {
  assert.equal(parseEvent(event).startsAt, "2026-10-20T09:00:00.000Z");
  assert.throws(() => parseEvent({ ...event, capacity: 0 }));
  assert.throws(() => parseEvent({ ...event, startsAt: "2026-10-20" }));
  assert.throws(() => parseEvent({ ...event, endsAt: event.startsAt }));
});
test("question choices, required answers and unknown fields are enforced", () => {
  const qs = parseQuestions([
    {
      id: "food",
      title: "Food",
      type: "multiple",
      required: true,
      options: ["A", "B"],
    },
  ]);
  assert.deepEqual(parseAnswers({ food: ["A"] }, qs), { food: ["A"] });
  for (const value of [
    { food: [] },
    { food: ["C"] },
    { food: ["A", "A"] },
    { food: ["A"], admin: true },
  ])
    assert.throws(() => parseAnswers(value, qs));
  assert.throws(() =>
    parseQuestions([
      { id: "bad.id", title: "Q", type: "text", required: true, options: [] },
    ]),
  );
});
test("memory isolation, consent-independent visibility and attendance rules", () => {
  const input = {
    viewer: "u",
    owner: "owner",
    visibility: "participants",
    attended: false,
    manager: false,
    completed: true,
    hidden: false,
    blocked: false,
  };
  assert.equal(canReadMemory(input), false);
  assert.equal(canReadMemory({ ...input, attended: true }), true);
  assert.equal(
    canReadMemory({ ...input, visibility: "private", attended: true }),
    false,
  );
  assert.equal(
    canReadMemory({ ...input, visibility: "public", viewer: null }),
    true,
  );
  assert.equal(
    canReadMemory({ ...input, viewer: "owner", hidden: true }),
    false,
  );
  assert.equal(
    canReadMemory({ ...input, visibility: "public", blocked: true }),
    false,
  );
});
test("completed/cancelled events never reopen and UUIDs cannot inject queries", () => {
  assert.equal(canTransition("open", "closed"), true);
  assert.equal(canTransition("completed", "open"), false);
  assert.throws(() => uuid("id&role=admin"));
});
