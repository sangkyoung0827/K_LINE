import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Validation-only entry point. Never exposes an HTTP endpoint or changes a project setting.
if (process.env.EVENT_NOTICE_PRIVATE_BUILD_APPROVED !== "true") throw Error("PRIVATE_NOTICE_BUILD_APPROVAL_REQUIRED");
const audit = spawnSync(process.execPath, ["scripts/event-studio-notice-audit.mjs"], {
  stdio: "inherit", env: { ...process.env, EVENT_NOTICE_LIVE_AUDIT: "true", WOOHYUKMON_PREVIEW_OPENAI_ENABLED: "true",
    EVENT_NOTICE_AUDIT_USE_SERVER_ENV: "true", EVENT_NOTICE_AUDIT_OUTPUT: join(tmpdir(), "kline-notice-quality-20261026.json") },
});
if (audit.status !== 0) process.exit(audit.status || 1);
const build = spawnSync("npm", ["run", "build"], { stdio: "inherit", env: process.env });
process.exit(build.status === 0 ? 0 : build.status || 1);
