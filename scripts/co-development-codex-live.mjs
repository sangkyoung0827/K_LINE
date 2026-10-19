import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { build } from "esbuild";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = new URL(process.env.LAB_PREVIEW_URL || "http://localhost:3365");
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("Local isolated preview only");
const collaborator = "noritakeyuki@fuji.waseda.jp", owner = "waterfallingsound0827@gmail.com";
async function session(body, email = collaborator) {
  const response = await fetch(new URL("/api/co-development", origin), { method: "POST", headers: { Origin: origin.origin, "Content-Type": "application/json", Cookie: `kline_lab_preview_identity=${email}` }, body: JSON.stringify(body) });
  const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
}
const issued = await session({ action: "token_rotate" });
const client = new Client({ name: "codex-isolated-http-qa", version: "1.0.0" });
const call = async (name, args = {}) => { const result = await client.callTool({ name, arguments: args }); assert.notEqual(result.isError, true, JSON.stringify(result)); return result.structuredContent.result; };
try {
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/co-development/mcp", origin), { requestInit: { headers: { Authorization: `Bearer ${issued.token}` } } }));
  const starterResponse = await fetch(new URL("/api/co-development/starter", origin));
  assert.equal(starterResponse.status, 200);
  const zip = await JSZip.loadAsync(await starterResponse.arrayBuffer());
  const files = {};
  for (const [name, file] of Object.entries(zip.files)) if (!file.dir && name !== ".gitignore") files[name] = await file.async("string");
  const compiled = await build({ stdin: { contents: files["src/main.js"], loader: "js" }, bundle: true, write: false, format: "iife", minify: true, plugins: [{ name: "inline-css", setup(builder) {
    builder.onResolve({ filter: /^\.\/style\.css$/ }, () => ({ path: "style", namespace: "starter" }));
    builder.onLoad({ filter: /.*/, namespace: "starter" }, () => ({ contents: files["src/style.css"], loader: "text" }));
  } }] });
  const id = randomUUID();
  const saved = await call("lab_save_bundle", { id, expectedRevision: 0, title: "Yuki Club · Codex 격리 검증", description: "Synthetic source + shared backend test, not production", html: `<meta name="viewport" content="width=device-width,initial-scale=1"><main id="app"></main><script>${compiled.outputFiles[0].text}</script>`, fixture: {}, files });
  const first = await call("lab_save_record", { projectId: id, collection: "members", id: randomUUID(), expectedVersion: 0, data: { name: "Test Member A", paid: false, present: false } });
  await call("lab_save_record", { projectId: id, collection: "members", id: randomUUID(), expectedVersion: 0, data: { name: "Test Member B", paid: false, present: false } });
  await call("lab_save_record", { projectId: id, collection: "members", id: first.id, expectedVersion: 1, data: { ...first.data, paid: true, present: true } });
  const ownerRecords = await session({ action: "records_list", projectId: id, collection: "members" }, owner);
  assert.equal(ownerRecords.records.length, 2); assert.equal(ownerRecords.records.find(row => row.id === first.id).data.paid, true);
  const settings = await call("lab_settings");
  await call("lab_customize", { expectedVersion: settings.version, appearance: { ...settings.appearance, title: "Yuki Development Lab", landingProjectId: id } });
  const source = await session({ action: "source_get", revisionId: saved.revisionId }, owner);
  assert.deepEqual(source.files, files);
  console.log(JSON.stringify({ projectId: id, revision: saved.project.revision, files: Object.keys(files).length, testMembers: ownerRecords.records.length, nativeMcp: "passed", ownerRead: "passed", sourceHash: source.sourceHash, preview: new URL("/co-development", origin).href }, null, 2));
} finally { await client.close(); await session({ action: "token_revoke" }); }
