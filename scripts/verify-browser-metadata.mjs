import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(label, source, text) {
  if (!source.includes(text)) {
    errors.push(`${label}: expected ${JSON.stringify(text)}`);
  }
}

function forbidText(label, source, text) {
  if (source.includes(text)) {
    errors.push(`${label}: forbidden browser metadata reference ${JSON.stringify(text)}`);
  }
}

function verifySquareSvg(relativePath) {
  const source = read(relativePath);
  const match = source.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
  if (!match) {
    errors.push(`${relativePath}: SVG must declare a viewBox`);
    return;
  }

  const width = Number(match[3]);
  const height = Number(match[4]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width !== height) {
    errors.push(`${relativePath}: browser/PWA icon SVG must have a square viewBox; got ${width}x${height}`);
  }
}

function verifyMaskableRasterBlocks(manifestSource) {
  const objectBlocks = manifestSource.match(/\{[\s\S]*?\}/g) ?? [];

  for (const block of objectBlocks) {
    if (!/purpose:\s*["']maskable["']/.test(block)) continue;
    if (!/type:\s*["']image\/png["']/.test(block)) continue;

    const size = block.match(/sizes:\s*["'](\d+)x(\d+)["']/);
    if (!size) {
      errors.push("manifest.ts: maskable PNG icon must declare an explicit WxH size");
      continue;
    }

    const width = Number(size[1]);
    const height = Number(size[2]);
    if (width !== height) {
      errors.push(`manifest.ts: maskable PNG must be square; declared ${width}x${height}`);
    }

    const src = block.match(/src:\s*["']([^"']+)["']/)?.[1];
    if (!src?.startsWith("/")) continue;

    const relativePath = path.join("public", src.slice(1));
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`manifest.ts: maskable PNG does not exist: ${relativePath}`);
      continue;
    }

    const buffer = fs.readFileSync(absolutePath);
    const pngSignature = "89504e470d0a1a0a";
    if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== pngSignature) {
      errors.push(`manifest.ts: ${relativePath} is declared as PNG but is not a valid PNG header`);
      continue;
    }

    const actualWidth = buffer.readUInt32BE(16);
    const actualHeight = buffer.readUInt32BE(20);
    if (actualWidth !== actualHeight) {
      errors.push(`manifest.ts: maskable PNG file must be square; ${relativePath} is ${actualWidth}x${actualHeight}`);
    }
    if (actualWidth !== width || actualHeight !== height) {
      errors.push(`manifest.ts: declared ${width}x${height} but ${relativePath} is actually ${actualWidth}x${actualHeight}`);
    }
  }
}

const manifest = read("src/app/manifest.ts");
const layout = read("src/app/layout.tsx");

// Stable browser-facing icon contract. Visual/site logos may change elsewhere,
// but these values require an intentional safety review before modification.
requireText("manifest.ts", manifest, 'src: "/favicon.svg"');
requireText("manifest.ts", manifest, 'sizes: "any"');
requireText("manifest.ts", manifest, 'src: "/k-line-mark.svg"');
requireText("manifest.ts", manifest, 'sizes: "512x512"');
requireText("manifest.ts", manifest, 'purpose: "maskable"');
requireText("layout.tsx", layout, 'icon: "/favicon.svg"');
requireText("layout.tsx", layout, 'shortcut: "/favicon.svg"');
requireText("layout.tsx", layout, 'apple: "/k-line-mark.svg"');

// The visual K_LINE logo is deliberately not permitted as browser metadata.
forbidText("manifest.ts", manifest, "/images/k-line-official-logo.png");
forbidText("layout.tsx", layout, "/images/k-line-official-logo.png");

verifySquareSvg("public/favicon.svg");
verifySquareSvg("public/k-line-mark.svg");
verifyMaskableRasterBlocks(manifest);

if (errors.length > 0) {
  console.error("\nBrowser metadata safety check FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  console.error("\nDo not deploy. If browser metadata must change intentionally, use square, correctly declared icons and update this safety contract in the same reviewed PR.\n");
  process.exit(1);
}

console.log("Browser metadata safety check passed.");
