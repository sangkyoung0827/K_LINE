import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export function releaseBlockers(status, platform = "all") {
  if (!["all", "ios", "android"].includes(platform)) {
    throw new Error("Platform must be all, ios or android.");
  }
  const required = [
    "DEVELOPMENT_COMPLETE",
    "TESTING_COMPLETE",
    "productionMigrationApplied",
    "productionDeploymentPerformed",
    "physicalDeviceTestsPerformed",
    "productionNextAuthAppLinkVerified",
    "nativeDeviceOAuthVerified",
  ];
  if (platform !== "android") required.push("appleDeveloperEnrolled");
  if (platform !== "ios") required.push("googlePlayConsoleEnrolled");
  return required.filter((field) => status[field] !== true);
}

async function main() {
  const hook = process.argv.includes("--eas-hook");
  if (hook && process.env.EAS_BUILD_PROFILE !== "production") return;
  const platform = hook
    ? process.env.EAS_BUILD_PLATFORM || "all"
    : process.argv.find((value) => value.startsWith("--platform="))?.split("=")[1] || "all";
  const status = JSON.parse(await readFile(new URL("../../../docs/woohyukmon-1/release-status.json", import.meta.url), "utf8"));
  const blockers = releaseBlockers(status, platform);
  if (blockers.length) {
    console.error("STORE BUILD BLOCKED. Evidence is missing for:");
    blockers.forEach((field) => console.error(`- ${field}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Recorded ${platform} pre-build gates passed; signing, review and publication remain separate.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
