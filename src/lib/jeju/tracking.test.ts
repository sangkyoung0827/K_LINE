import assert from "node:assert/strict";
import test from "node:test";
import {
  TRACK_POINT_MIN_INTERVAL_MS,
  TRACK_POINT_STATIONARY_INTERVAL_MS,
  isValidJejuLocation,
  shouldPersistTrackPoint
} from "@/lib/jeju/tracking";

const origin = { latitude: 33.4996, longitude: 126.5312, recordedAt: "2026-08-26T00:00:00.000Z" };

test("Explore tracking keeps a moved location after the minimum interval", () => {
  assert.equal(
    shouldPersistTrackPoint(origin, {
      latitude: 33.5001,
      longitude: 126.5312,
      recordedAt: new Date(new Date(origin.recordedAt).getTime() + TRACK_POINT_MIN_INTERVAL_MS).toISOString()
    }),
    true
  );
});

test("Explore tracking does not store every stationary GPS sample", () => {
  assert.equal(
    shouldPersistTrackPoint(origin, {
      latitude: 33.49961,
      longitude: 126.5312,
      recordedAt: new Date(new Date(origin.recordedAt).getTime() + TRACK_POINT_MIN_INTERVAL_MS).toISOString()
    }),
    false
  );
});

test("Explore tracking keeps a stationary reference point after a longer interval", () => {
  assert.equal(
    shouldPersistTrackPoint(origin, {
      latitude: 33.49961,
      longitude: 126.5312,
      recordedAt: new Date(new Date(origin.recordedAt).getTime() + TRACK_POINT_STATIONARY_INTERVAL_MS).toISOString()
    }),
    true
  );
});

test("Explore tracking accepts only Jeju coordinate bounds", () => {
  assert.equal(isValidJejuLocation({ latitude: 33.4996, longitude: 126.5312 }), true);
  assert.equal(isValidJejuLocation({ latitude: 37.5665, longitude: 126.978 }), false);
});
