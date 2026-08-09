import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const faviconPath = path.join(root, "public", "favicon.svg");
const manifestPath = path.join(root, "src", "app", "manifest.ts");
const layoutPath = path.join(root, "src", "app", "layout.tsx");

const [favicon, faviconStats, manifest, layout] = await Promise.all([
  readFile(faviconPath, "utf8"),
  stat(faviconPath),
  readFile(manifestPath, "utf8"),
  readFile(layoutPath, "utf8")
]);

const failures = [];
if (!favicon.includes("<svg")) failures.push("public/favicon.svg is not an SVG document.");
if (faviconStats.size > 32 * 1024) failures.push("public/favicon.svg exceeds the 32 KB safety limit.");
if (!manifest.includes('src: "/favicon.svg"')) failures.push("Manifest no longer uses the established safe favicon asset.");
if (!layout.includes('icon: "/favicon.svg"') || !layout.includes('shortcut: "/favicon.svg"')) {
  failures.push("Root metadata no longer uses the established safe favicon asset.");
}
if (/k-line-official-logo\.png|woohyukmon-icon\.png/.test(manifest)) {
  failures.push("Large raster artwork must not be registered as a PWA icon.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Browser metadata safety check passed.");
