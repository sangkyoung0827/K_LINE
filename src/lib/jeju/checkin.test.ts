import assert from "node:assert/strict";
import test from "node:test";
import { CHECK_IN_RADIUS_METERS, getDistanceInMeters, isWithinCheckInRadius } from "@/lib/jeju/checkin";

test("Jeju check-in permits a point inside the default 150 metre radius", () => {
  const place = { latitude: 33.4996, longitude: 126.5312 };
  const nearby = { latitude: 33.5001, longitude: 126.5312 };

  assert.ok(getDistanceInMeters(nearby, place) < CHECK_IN_RADIUS_METERS);
  assert.equal(isWithinCheckInRadius(nearby, place), true);
});

test("Jeju check-in rejects a point outside the default 150 metre radius", () => {
  const place = { latitude: 33.4996, longitude: 126.5312 };
  const farAway = { latitude: 33.503, longitude: 126.5312 };

  assert.ok(getDistanceInMeters(farAway, place) > CHECK_IN_RADIUS_METERS);
  assert.equal(isWithinCheckInRadius(farAway, place), false);
});
