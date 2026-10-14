import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const apk = "android/app/build/outputs/apk/release/app-release.apk";
const bytes = await readFile(apk);
const badging = await readFile("apk-badging.txt", "utf8");
const permissions = await readFile("apk-permissions.txt", "utf8");
assert.ok(badging.includes("package: name='com.kline.woohyukmon'"));
assert.ok(badging.includes("우혁몬(WOOHYUKMON)"));
assert.ok(badging.includes("native-code: 'arm64-v8a'"));
assert.ok(!permissions.includes("android.permission.CAMERA"));
assert.ok(!permissions.includes("android.permission.RECORD_AUDIO"));
assert.ok(!permissions.includes("android.permission.SYSTEM_ALERT_WINDOW"));
const entries = execFileSync("unzip", ["-Z1", apk], { encoding: "utf8" }).split("\n");
assert.ok(entries.includes("assets/index.android.bundle"), "APK must launch without a Metro server.");
const certificate = execFileSync(`${process.env.ANDROID_HOME}/build-tools/36.0.0/apksigner`, ["verify", "--print-certs", apk], { encoding: "utf8" });
assert.match(certificate, /Signer #1 certificate DN:.*CN=Android Debug/i, "Only the template test key may be used by this workflow.");
const sha256 = createHash("sha256").update(bytes).digest("hex");
await writeFile("apk-verification.json", JSON.stringify({
  sha256,
  bytes: bytes.length,
  package: "com.kline.woohyukmon",
  architecture: "arm64-v8a",
  signing: "android-debug-template-test-only",
  embeddedBundle: true,
  backendReady: false,
  storeSubmitted: false,
  sourceCommit: process.env.GITHUB_SHA || null,
}, null, 2) + "\n");
console.log(`Test APK verified: ${bytes.length} bytes; SHA-256 ${sha256}`);
