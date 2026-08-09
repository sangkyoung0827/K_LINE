import fs from "node:fs";
import path from "node:path";

const buildDirectory = path.join(process.cwd(), ".next");
const appManifestPath = path.join(buildDirectory, "app-build-manifest.json");
const buildManifestPath = path.join(buildDirectory, "build-manifest.json");

if (!fs.existsSync(appManifestPath) || !fs.existsSync(buildManifestPath)) {
  throw new Error("Build manifests are missing. Run npm run build before checking V4 isolation.");
}

const appManifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8"));
const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8"));
const publicRoutes = ["/page", "/contact/page"];
const publicChunks = new Set(publicRoutes.flatMap((route) => appManifest.pages[route] ?? []));
const financeChunks = new Set(
  Object.entries(appManifest.pages)
    .filter(([route]) => route.startsWith("/v4/finance"))
    .flatMap(([, chunks]) => chunks)
);
const sharedChunks = new Set([...(buildManifest.rootMainFiles ?? []), ...(buildManifest.lowPriorityFiles ?? [])]);
const leakedChunks = [...publicChunks].filter((chunk) => financeChunks.has(chunk) && !sharedChunks.has(chunk));

if (leakedChunks.length > 0) {
  throw new Error(`Finance-only chunks leaked into public routes: ${leakedChunks.join(", ")}`);
}

console.log("V4 isolation check passed.");
console.log(`Public route chunks checked: ${publicChunks.size}`);
console.log(`Finance route chunks isolated: ${[...financeChunks].filter((chunk) => !sharedChunks.has(chunk)).length}`);
