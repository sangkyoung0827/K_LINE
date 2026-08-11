import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "src/lib/traditional-liquor");
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}

const collectionFiles = (await files(join(root, "collection"))).concat(await files(join(root, "import")));
const clientFiles = (await files(join(process.cwd(), "src/components/traditional-liquor"))).filter((path) => path.endsWith(".tsx"));
const forbiddenProductionWrites = /supabaseRequest\([^\n]*(traditional_liquor_products|traditional_liquor_offers|traditional_liquor_price_history)[^\n]*method:\s*["'](?:POST|PATCH|DELETE)/;
for (const path of collectionFiles) {
  const source = await readFile(path, "utf8");
  if (forbiddenProductionWrites.test(source)) throw new Error(`Collector production write found: ${path}`);
}
for (const path of clientFiles) {
  const source = await readFile(path, "utf8");
  if (/SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey/.test(source)) throw new Error(`Server secret reference found in client file: ${path}`);
}
console.log("Traditional liquor collection safety checks passed.");
