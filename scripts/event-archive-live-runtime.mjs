// Operator-only entry point. No identity, database, Storage or AI transport mocks.
import { readFile, mkdtemp } from "node:fs/promises";
import { parseEnv } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { build } from "esbuild";

export async function liveArchiveRuntime() {
  const envFile = process.env.EVENT_ARCHIVE_OPERATOR_ENV;
  if (!envFile) throw Error("Operator server environment file required");
  Object.assign(process.env, parseEnv(await readFile(envFile, "utf8")));
  if (process.env.EVENT_ARCHIVE_OPERATOR_AI_ENV) Object.assign(process.env, parseEnv(await readFile(process.env.EVENT_ARCHIVE_OPERATOR_AI_ENV, "utf8")));
  if (new URL(process.env.SUPABASE_URL).hostname !== "okcabiimxuhhhokqajjg.supabase.co" || !process.env.SUPABASE_SERVICE_ROLE_KEY || /sensitive|masked|null/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY)) throw Error("Approved project credentials required");
  Object.assign(process.env, { EVENT_ARCHIVE_ENABLED: "true", EVENT_ARCHIVE_ENVIRONMENT: "production" });
  const dir = await mkdtemp(join(tmpdir(), "kline-archive-live-")), bundle = join(dir, "api.cjs");
  await build({ stdin: { contents: "export * from './src/lib/eventArchive/model';export * from './src/lib/eventArchive/integrity';export * from './src/lib/eventArchive/service';export * from './src/lib/eventArchive/ai';export * from './src/lib/eventArchive/store';export {getAdminAccess} from './src/lib/admin';", resolveDir: process.cwd(), loader: "ts" },
    bundle: true, packages: "external", platform: "node", format: "cjs", outfile: bundle,
    banner: { js: `module.paths.unshift(${JSON.stringify(join(process.cwd(), "node_modules"))});` },
    plugins: [{ name: "node-server-boundary", setup(b) {
      b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "node-boundary" }));
      b.onLoad({ filter: /.*/, namespace: "node-boundary" }, () => ({ contents: "" }));
    } }] });
  const api = createRequire(import.meta.url)(bundle);
  const email = process.env.EVENT_ARCHIVE_OPERATOR_EMAIL;
  if (!email) throw Error("Verified operator identity required");
  const authority = await api.getAdminAccess(email);
  if (!authority.isSuperAdmin || authority.isReadOnly) throw Error("Existing writable super-admin authority required");
  // The operator is explicitly authorized by the human for this single unclassified bundle.
  return { api, dir, access: { email: authority.email, clubs: ["unclassified"], superAdmin: true, readOnly: false } };
}
