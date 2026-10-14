import assert from "node:assert/strict";
import test from "node:test";
import { releaseBlockers } from "./check-release.mjs";

const complete = {
  DEVELOPMENT_COMPLETE: true,
  TESTING_COMPLETE: true,
  productionMigrationApplied: true,
  productionDeploymentPerformed: true,
  physicalDeviceTestsPerformed: true,
  productionNextAuthAppLinkVerified: true,
  nativeDeviceOAuthVerified: true,
  appleDeveloperEnrolled: true,
  googlePlayConsoleEnrolled: true,
};

test("missing evidence blocks store build even with exported JS or a preview APK", () => {
  const blocked = releaseBlockers({ javascriptBundlesExported: true, androidPreviewApkBuilt: true });
  assert.equal(blocked.length, 9);
  assert.ok(blocked.includes("nativeDeviceOAuthVerified"));
});
test("only explicit true qualifies as evidence", () => {
  assert.deepEqual(releaseBlockers({ ...complete, DEVELOPMENT_COMPLETE: "true" }), ["DEVELOPMENT_COMPLETE"]);
});
test("accounts are platform-specific and approval is not implied by build readiness", () => {
  assert.deepEqual(releaseBlockers({ ...complete, appleDeveloperEnrolled: false }, "android"), []);
  assert.deepEqual(releaseBlockers({ ...complete, googlePlayConsoleEnrolled: false }, "ios"), []);
  assert.deepEqual(releaseBlockers({ ...complete, PUBLISHED: false, APPROVED: false }), []);
});
test("unsupported platforms cannot bypass gates", () => {
  assert.throws(() => releaseBlockers(complete, "web"));
});
