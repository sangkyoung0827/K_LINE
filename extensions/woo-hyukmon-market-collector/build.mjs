import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const registryPath = path.resolve(root, "../../src/lib/traditional-liquor/collector/platform-registry.json");
const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

async function bundle(output, inputs, prelude = "") {
  const chunks = [prelude];
  for (const input of inputs) {
    const source = await fs.readFile(path.join(root, input), "utf8");
    chunks.push(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, removeComments: false } }).outputText);
  }
  await fs.writeFile(path.join(dist, output), chunks.join("\n"));
}

const registryPrelude = `globalThis.WHM_PLATFORM_REGISTRY = ${JSON.stringify(registry)};`;
await bundle("service-worker.js", ["src/shared/messages.ts", "src/background/service-worker.ts"], registryPrelude);
await bundle("platform-content.js", ["src/shared/messages.ts", "src/shared/payload.ts", "src/content/collectors/types.ts", "src/content/collectors/naver.ts", "src/content/collectors/kakao-gift.ts", "src/content/index.ts"], registryPrelude);
await bundle("webapp-bridge.js", ["src/shared/messages.ts", "src/content/webapp-bridge.ts"]);
await bundle("popup.js", ["src/shared/payload.ts", "src/popup/popup.ts"], registryPrelude);
await Promise.all(["manifest.json", "src/popup/popup.html", "src/popup/popup.css"].map(async (input) => {
  const output = input.startsWith("src/popup/") ? input.replace("src/popup/", "") : input;
  await fs.copyFile(path.join(root, input), path.join(dist, output));
}));
console.log(`WooHyukmon Market Collector built: ${dist}`);
