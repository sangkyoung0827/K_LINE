import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// CLI-only bundling removes Next's build-time marker. No HTTP route uses this runner.
const directory = await mkdtemp(join(tmpdir(), "kline-preference-job-"));
try {
  const outfile = join(directory, "job.mjs");
  await build({
    entryPoints: ["scripts/reconcile-activity-preferences.ts"], outfile, bundle: true,
    platform: "node", format: "esm", logLevel: "silent",
    plugins: [{ name: "cli-request-context", setup(builder) {
      builder.onResolve({ filter: /^(server-only|next\/headers)$/ }, ({ path }) => ({ path, namespace: "cli" }));
      builder.onLoad({ filter: /.*/, namespace: "cli" }, ({ path }) => ({ contents: path === "server-only" ? "" : 'export async function headers() { throw new Error("outside a request scope"); }' }));
    } }]
  });
  const { main } = await import(pathToFileURL(outfile).href);
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Preference job failed.");
  process.exitCode = 1;
} finally { await rm(directory, { recursive: true, force: true }); }
