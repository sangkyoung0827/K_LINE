import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server.js";
import { coDevelopmentHarness } from "./co-development-harness.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import JSZip from "jszip";
import { build } from "esbuild";
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { MessageChannel } from "node:worker_threads";

let h;
before(async () => { h = await coDevelopmentHarness(); });
after(async () => { await h?.close(); });
const draft = () => ({ action: "save", id: randomUUID(), expectedRevision: 0, title: "QA prototype", description: "Synthetic tests only", html: '<button id="counter">Add</button><script>document.title="Test";</script>', fixture: { count: 0 } });
async function ok(body, email, options) {
  const response = await h.call(body, email, options);
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result;
}

test("exactly two accounts can see the workspace policy, regardless of developer role", () => {
  for (const email of [h.api.labOwner, h.api.labCollaborator, ` ${h.api.labCollaborator.toUpperCase()} `]) assert.equal(h.api.canUseCoDevelopment(email), true);
  for (const email of [null, "", "other-admin@example.test", "waterfallingsound0827@gamail.com", "noritakeyuki@fuji.waseda.jp.evil.test"]) assert.equal(h.api.canUseCoDevelopment(email), false);
});

test("both encrypted Google-session identities can save and run the same revision", async () => {
  assert.deepEqual((await ok({ action: "list" })).projects, []);
  assert.equal((await ok({ action: "settings_get" })).version, 0);
  const input = draft(); const saved = await ok(input);
  const owner = await ok({ action: "get", id: saved.project.id }, h.api.labOwner);
  assert.equal(owner.project.html, input.html); assert.equal(owner.project.created_by, h.api.labCollaborator);
  const revisionId = owner.revisions[0].id;
  assert.equal(owner.revisions[0].html, undefined);
  const state = await ok({ action: "state_read", revisionId }); assert.deepEqual(state.data, { count: 0 });
  await ok({ action: "state_save", revisionId, data: { count: 3 }, expectedVersion: 0 });
  const ownerState = await ok({ action: "state_read", revisionId }, h.api.labOwner);
  assert.deepEqual(ownerState, { data: { count: 3 }, version: 1 });
  const response = await h.handle(new NextRequest(`http://127.0.0.1:3365/api/co-development/preview/${revisionId}`, { headers: { cookie: await h.cookie(h.api.labOwner) } }));
  assert.equal(response.status, 200); assert.match(response.headers.get("content-security-policy"), /sandbox allow-scripts/);
  assert.match(response.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(await response.text(), /window.KLINE_LAB/);
});

test("normal members, other developers, anonymous users and spoofed identity headers cannot access prototypes", async () => {
  for (const email of [null, "member@example.test", "other-developer@example.test"]) {
    const response = await h.call({ action: "list" }, email, { headers: { "x-email": h.api.labOwner, "x-kline-read-only-developer": "0" } });
    assert.ok([401, 403].includes(response.status));
  }
  const response = await h.call({ action: "list" }, h.api.labCollaborator, { headers: { origin: "https://evil.test" } });
  assert.equal(response.status, 403);
});

test("concurrent edits conflict; revisions are immutable and new revisions have fresh test state", async () => {
  const input = draft(); const saved = await ok(input);
  const before = await ok({ action: "get", id: input.id }); const oldId = before.revisions[0].id;
  await ok({ action: "state_save", revisionId: oldId, data: { count: 5 }, expectedVersion: 0 });
  const updated = await ok({ ...input, expectedRevision: saved.project.revision, html: "<p>Revision two</p>" }, h.api.labOwner);
  assert.equal(updated.project.revision, 2);
  const conflict = await h.call({ ...input, expectedRevision: 1 }); assert.equal(conflict.status, 409);
  const after = await ok({ action: "get", id: input.id }); assert.equal(after.revisions.length, 2);
  assert.equal((await ok({ action: "revision", revisionId: oldId })).revision.html, input.html);
  assert.deepEqual((await ok({ action: "state_read", revisionId: after.revisions[0].id })).data, { count: 0 });
  assert.equal((await h.call({ action: "state_save", revisionId: oldId, data: {}, expectedVersion: 0 })).status, 409);
});

test("review requests cannot publish, approve, touch repositories or retain approval after edits", async () => {
  const input = draft(); await ok(input);
  const reviewed = await ok({ action: "review", id: input.id, expectedRevision: 1 });
  assert.equal(reviewed.project.review_state, "review_requested");
  for (const action of ["approve", "publish", "deploy", "sql", "github", "delete"]) assert.equal((await h.call({ action, id: input.id })).status, 400);
  assert.equal((await ok({ ...input, expectedRevision: 1 })).project.review_state, "draft");
});

test("personal GPT keys can save prototypes but cannot issue keys, request review or use runtime state", async () => {
  const issued = await ok({ action: "token_rotate" }); assert.match(issued.token, /^kll_[a-f0-9]{64}$/);
  const stored = (await h.db.query("select token_hash from co_dev_tokens where email=$1", [h.api.labCollaborator])).rows[0].token_hash;
  assert.equal(stored, createHash("sha256").update(issued.token).digest("hex")); assert.notEqual(stored, issued.token);
  const options = { url: "https://kline.test/api/co-development/actions", headers: { authorization: `Bearer ${issued.token}` } };
  const saved = await ok(draft(), null, options); assert.equal(saved.project.created_by, h.api.labCollaborator);
  for (const action of ["token_rotate", "review", "state_read", "publish"]) assert.equal((await h.call({ action }, null, options)).status, 403);
  assert.equal((await h.call({ action: "list" }, null, { headers: options.headers })).status, 403);
  const rotated = await ok({ action: "token_rotate" }); assert.notEqual(rotated.token, issued.token);
  assert.equal((await h.call({ action: "list" }, null, options)).status, 403);
  await ok({ action: "token_revoke" });
  assert.equal((await h.call({ action: "list" }, null, { ...options, headers: { authorization: `Bearer ${rotated.token}` } })).status, 403);
  const expiring = await ok({ action: "token_rotate" });
  await h.db.query("update co_dev_tokens set expires_at=now()-interval '1 minute' where email=$1", [h.api.labCollaborator]);
  assert.equal((await h.call({ action: "list" }, null, { ...options, headers: { authorization: `Bearer ${expiring.token}` } })).status, 403);
});

test("schema is private and only exposes limited lab actions", async () => {
  const response = await h.handle(new NextRequest("http://127.0.0.1:3365/api/co-development/schema", { headers: { cookie: await h.cookie(h.api.labCollaborator) } }));
  assert.equal(response.status, 200); const schema = await response.json();
  assert.deepEqual(Object.keys(schema.paths), ["/api/co-development/actions"]);
  assert.deepEqual(schema.paths["/api/co-development/actions"].post.requestBody.content["application/json"].schema.properties.action.enum, ["list", "get", "save", "settings_get", "settings_save"]);
});

test("Yuki's GPT can redesign the card and choose a shared opening screen without owner intervention", async () => {
  const project = await ok(draft());
  const { token } = await ok({ action: "token_rotate" });
  const options = { url: "https://kline.test/api/co-development/actions", headers: { authorization: `Bearer ${token}` } };
  const previous = await ok({ action: "settings_get" }, null, options);
  const appearance = { ...previous.appearance, title: "Yuki's workspace", description: "Private experiments", background: "#f0fcf7", accent: "#184335", cardHtml: '<style>body{margin:0;background:#154339;color:white}</style><h1>Yuki Lab</h1>', landingProjectId: project.project.id };
  const updated = await ok({ action: "settings_save", appearance, expectedVersion: previous.version }, null, options);
  const owner = await ok({ action: "settings_get" }, h.api.labOwner);
  assert.deepEqual(owner, updated); assert.deepEqual(owner.appearance, appearance);
  const first = await ok({ action: "get", id: owner.appearance.landingProjectId }, h.api.labOwner);
  assert.equal(first.project.id, project.project.id);
  const history = (await h.db.query("select * from co_dev_settings_history where version=$1", [updated.version])).rows[0];
  assert.equal(history.updated_by, h.api.labCollaborator); assert.deepEqual(history.appearance, appearance);
  assert.equal((await h.call({ action: "settings_save", appearance, expectedVersion: previous.version }, null, options)).status, 409);
  assert.equal((await ok({ action: "get", id: project.project.id })).project.review_state, "draft");
  const card = await h.handle(new NextRequest("https://kline.test/api/co-development/card", { headers: { cookie: await h.cookie(h.api.labOwner, true) } }));
  assert.equal(card.status, 200); assert.equal(await card.text(), appearance.cardHtml);
  assert.match(card.headers.get("content-security-policy"), /sandbox allow-scripts/); assert.match(card.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal(card.headers.get("cache-control"), "private, no-store");
  for (const email of [null, "member@example.test", "developer@example.test"]) {
    assert.ok([401, 403].includes((await h.call({ action: "settings_get" }, email)).status));
    const response = await h.handle(new NextRequest("https://kline.test/api/co-development/card", { headers: email ? { cookie: await h.cookie(email, true) } : {} }));
    assert.ok([401, 403].includes(response.status));
  }
  const invalid = [ { ...appearance, accent: "red;position:fixed" }, { ...appearance, cardHtml: "x".repeat(65537) }, { ...appearance, landingProjectId: "../../admin" }, { ...appearance, production: true } ];
  for (const value of invalid) assert.ok([400, 413].includes((await h.call({ action: "settings_save", appearance: value, expectedVersion: updated.version }, null, options)).status));
  assert.equal((await h.call({ action: "settings_save", appearance: { ...appearance, landingProjectId: randomUUID() }, expectedVersion: updated.version }, null, options)).status, 404);
  const escaped = await ok({ action: "settings_save", appearance: { ...appearance, cardHtml: '"'.repeat(65536) }, expectedVersion: updated.version }, null, options);
  assert.equal(escaped.appearance.cardHtml.length, 65536);
  await ok({ action: "settings_save", appearance: { ...h.api.defaultLabAppearance }, expectedVersion: escaped.version }, null, options);
  assert.equal((await h.db.query("select appearance from co_dev_settings_history where version=$1", [updated.version])).rows[0].appearance.title, appearance.title);
});

test("database roles cannot read or mutate prototype source, states or tokens", async () => {
  for (const role of ["anon", "authenticated"]) {
    await h.db.exec(`set role ${role}`);
    for (const table of ["co_dev_projects", "co_dev_revisions", "co_dev_states", "co_dev_tokens", "co_dev_settings", "co_dev_settings_history", "co_dev_sources", "co_dev_records", "co_dev_record_history"]) {
      await assert.rejects(h.db.query(`select * from ${table}`), /permission denied/);
      await assert.rejects(h.db.query(`delete from ${table}`), /permission denied/);
    }
    await assert.rejects(h.db.query("select public.co_dev_list($1)", [h.api.labOwner]), /permission denied/);
    await assert.rejects(h.db.query("select public.co_dev_settings_get($1)", [h.api.labOwner]), /permission denied/);
    await assert.rejects(h.db.query("select public.co_dev_settings_save($1,0,'{}'::jsonb)", [h.api.labOwner]), /permission denied/);
    await assert.rejects(h.db.query("select public.co_dev_records_list($1,$2,'members',null,50,false)", [h.api.labOwner, randomUUID()]), /permission denied/);
  }
  await h.db.exec("set role service_role");
  await assert.rejects(h.db.query("delete from co_dev_revisions"), /permission denied/);
  await assert.rejects(h.db.query("update co_dev_settings_history set appearance='{}'::jsonb"), /permission denied/);
  await assert.rejects(h.db.query("delete from co_dev_sources"), /permission denied/);
  await assert.rejects(h.db.query("update co_dev_record_history set data='{}'::jsonb"), /permission denied/);
});

test("multi-file source bundles are immutable, hashed and atomically attached to their exact UI revision", async () => {
  const input = { ...draft(), action: "bundle_save", files: { "src/main.js": "document.body.textContent='Test'", "README.md": "Synthetic project only" } };
  const result = await ok(input); const current = await ok({ action: "get", id: input.id }, h.api.labOwner);
  const source = await ok({ action: "source_get", revisionId: current.revisions[0].id }, h.api.labOwner);
  assert.deepEqual(source.files, input.files); assert.equal(result.revisionId, current.revisions[0].id);
  assert.equal(source.sourceHash, createHash("sha256").update(JSON.stringify(h.api.labSources(input.files))).digest("hex"));
  await ok({ ...input, expectedRevision: 1, files: { "src/main.js": "// new version" } });
  assert.deepEqual((await ok({ action: "source_get", revisionId: result.revisionId })).files, input.files);
  for (const path of ["../outside.js", "/etc/passwd", ".env", "src/.env.local", "src/../../admin.ts", "node_modules/pkg.js", "secrets/key.txt", "src/key.pem"]) {
    assert.equal((await h.call({ ...input, expectedRevision: 2, files: { [path]: "forbidden" } })).status, 400);
  }
  assert.equal((await h.call({ ...input, expectedRevision: 2, files: { "big.js": "a".repeat(1048577) } })).status, 413);
  assert.equal((await h.call({ ...input, expectedRevision: 2, files: { "main.js": `const token='kll_${"a".repeat(64)}'` } })).status, 400);
  assert.equal((await ok({ action: "get", id: input.id })).project.revision, 2);
});

test("project test backend persists across revisions, paginates, detects conflicts and supports reversible archiving", async () => {
  const input = draft(); await ok(input); const other = draft(); await ok(other);
  const id = randomUUID(); const request = { action: "record_save", projectId: input.id, collection: "members", id, data: { name: "Synthetic A", paid: false, present: false }, expectedVersion: 0 };
  const first = await ok(request); assert.equal(first.updated_by, h.api.labCollaborator);
  const second = await ok({ ...request, data: { ...request.data, paid: true, present: true }, expectedVersion: 1 }, h.api.labOwner);
  assert.equal(second.version, 2); assert.equal(second.updated_by, h.api.labOwner);
  assert.equal((await h.call({ ...request, expectedVersion: 1 })).status, 409);
  await ok({ ...input, expectedRevision: 1, html: "<h1>Replaced interface</h1>" });
  const list = await ok({ action: "records_list", projectId: input.id, collection: "members" });
  assert.deepEqual(list.records[0].data, second.data);
  assert.deepEqual((await ok({ action: "records_list", projectId: other.id, collection: "members" })).records, []);
  assert.equal((await h.call({ ...request, projectId: other.id, expectedVersion: 2 })).status, 409);
  for (let n=0;n<3;n++) await ok({ ...request, id: randomUUID(), data: { name: `Synthetic ${n}` } });
  const one = await ok({ action: "records_list", projectId: input.id, collection: "members", limit: 2 });
  assert.equal(one.records.length, 2); assert.ok(one.nextCursor);
  const two = await ok({ action: "records_list", projectId: input.id, collection: "members", limit: 2, after: one.nextCursor });
  assert.equal(two.records.length, 2); assert.equal(two.nextCursor, null); assert.equal(new Set([...one.records,...two.records].map(row=>row.id)).size,4);
  await ok({ ...request, expectedVersion: 2, archived: true });
  assert.equal((await ok({ action: "records_list", projectId: input.id, collection: "members" })).records.some(row=>row.id===id),false);
  assert.equal((await ok({ action: "records_list", projectId: input.id, collection: "members",includeArchived:true })).records.find(row=>row.id===id).version,3);
  await ok({ ...request, expectedVersion: 3, archived: false });
  assert.equal((await h.db.query("select count(*)::int as n from co_dev_record_history where project_id=$1 and id=$2",[input.id,id])).rows[0].n,4);
  assert.equal((await h.call({ ...request, expectedVersion: 4, data: { text:"a".repeat(16385) } })).status,413);
  assert.equal((await h.call({ ...request, collection:"members;drop table x" })).status,400);
  for(const email of [null,"member@example.test","developer@example.test"]) assert.ok([401,403].includes((await h.call(request,email)).status));
});

test("browser SDK keeps request correlation separate from record ids and rejects envelope overrides", async () => {
  const listeners=new Map();const messages=[];const channel=new MessageChannel();
  const parent={postMessage(message){assert.equal(message.type,"kline-lab-ready");listeners.get("message")({source:parent,data:{type:"kline-lab-connect"},ports:[channel.port2]});}};
  const window={};channel.port1.onmessage=event=>{messages.push(event.data);channel.port1.postMessage({id:event.data.id,result:{data:{},version:1}});};
  try {
    const script=h.api.labPreviewHtml("").match(/<script>([\s\S]*?)<\/script>/)[1];
    runInNewContext(script,{parent,window,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),setTimeout,clearTimeout});
    const id=randomUUID();await window.KLINE_LAB.records.save("members",id,{paid:true},0);
    assert.equal(messages[0].id,1);assert.equal(messages[0].recordId,id);assert.equal(messages[0].action,"record_save");
    await window.KLINE_LAB.records.list("members",{id:"overwrite",action:"state_save"});
    assert.equal(messages[1].id,2);assert.equal(messages[1].action,"records_list");
    await window.KLINE_LAB.records.create("members",{paid:false});assert.equal(messages[2].id,3);assert.equal(messages[2].action,"record_create");
  } finally {channel.port1.close();channel.port2.close();}
});

test("native MCP SDK client initializes and develops a shared club-like project with no production or deploy tools", async () => {
  const issued = await ok({ action: "token_rotate" });
  const client = new Client({ name: "codex-protocol-qa", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://kline.test/api/co-development/mcp"), {
    requestInit: { headers: { Authorization: `Bearer ${issued.token}` } },
    fetch: (url, init) => h.handle(new NextRequest(url, init))
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map(item=>item.name);
    assert.deepEqual(tools.sort(),["lab_starter","lab_list","lab_get","lab_save_bundle","lab_source","lab_settings","lab_customize","lab_records","lab_save_record"].sort());
    const call = async (name,args={}) => { const result=await client.callTool({name,arguments:args}); assert.notEqual(result.isError,true,JSON.stringify(result)); return result.structuredContent.result; };
    const starter = await call("lab_starter"); assert.match(starter.files["README.md"], /bearer_token_env_var/); assert.match(starter.files["src/main.js"], /KLINE_LAB.records/);
    assert.ok(!JSON.stringify(starter).includes(issued.token));
    const files=Object.fromEntries(Object.entries(starter.files).filter(([name])=>name!==".gitignore"));
    const compiled=await build({stdin:{contents:files["src/main.js"],loader:"js"},bundle:true,write:false,format:"iife",plugins:[{name:"starter-css",setup(b){b.onResolve({filter:/^\.\/style\.css$/},()=>({path:"style",namespace:"starter"}));b.onLoad({filter:/.*/,namespace:"starter"},()=>({contents:files["src/style.css"],loader:"text"}));}}]});
    const project = await call("lab_save_bundle",{...draft(),html:`<main id="app"></main><script>${compiled.outputFiles[0].text}</script>`,files});
    const member = await call("lab_save_record",{projectId:project.project.id,collection:"members",id:randomUUID(),data:{name:"Synthetic member",paid:true,present:true},expectedVersion:0});
    assert.equal(member.updated_by,h.api.labCollaborator);
    const owner=await ok({action:"records_list",projectId:project.project.id,collection:"members"},h.api.labOwner);assert.equal(owner.records[0].data.paid,true);
    const settings=await call("lab_settings");await call("lab_customize",{expectedVersion:settings.version,appearance:{...settings.appearance,landingProjectId:project.project.id}});
    assert.deepEqual((await call("lab_source",{revisionId:project.revisionId})).files,files);
    const unknown=await client.callTool({name:"deploy",arguments:{}});assert.equal(unknown.isError,true);
    await ok({action:"token_revoke"}); await assert.rejects(client.callTool({name:"lab_list",arguments:{}}));
  } finally { await client.close(); }
  for (const email of [null,h.api.labCollaborator,"member@example.test"]) {
    const response=await h.call({jsonrpc:"2.0",id:1,method:"tools/list"},email,{url:"https://kline.test/api/co-development/mcp"});assert.ok([401,403].includes(response.status));
  }
});

test("source starter download is private and contains no account or server secret", async () => {
  const response=await h.handle(new NextRequest("https://kline.test/api/co-development/starter",{headers:{cookie:await h.cookie(h.api.labCollaborator,true)}}));
  assert.equal(response.status,200); assert.equal(response.headers.get("cache-control"),"private, no-store");
  const zip=await JSZip.loadAsync(await response.arrayBuffer());const readme=await zip.file("README.md").async("string");
  assert.match(readme,/own Codex/);assert.match(readme,/NOT executed|do not execute/i);
  const main=await zip.file("src/main.js").async("string");assert.ok(!main.includes(".onsubmit="));
  assert.ok(!main.includes("Yuki Club"));assert.ok(!main.includes("records.create("));assert.ok(!main.includes("innerHTML="));
  assert.ok(!zip.file(".env.local"));assert.ok(zip.file("src/main.js"));
  const anonymous=await h.handle(new NextRequest("https://kline.test/api/co-development/starter"));assert.equal(anonymous.status,401);
  const dir=await mkdtemp(join(tmpdir(),"yuki-starter-build-"));
  try {
    for(const [name,file] of Object.entries(zip.files)){if(file.dir)continue;const path=join(dir,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,await file.async("string"));}
    await symlink(join(process.cwd(),"node_modules"),join(dir,"node_modules"));
    await promisify(execFile)(process.execPath,["tools/build.mjs"],{cwd:dir});
    const html=await readFile(join(dir,"dist/index.html"),"utf8");assert.match(html,/id="app"/);assert.match(html,/<!doctype html>/);
    await promisify(execFile)(process.execPath,["--check","tools/sync.mjs"],{cwd:dir});
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("only namespaced lab mutations bypass the existing Yuki read-only middleware restriction", async () => {
  for (const path of ["/api/ecc/operations", "/api/admin/roles", "/developer", "/api/co-development-evil", "/api/google-forms/forms"]) {
    const response = await h.api.middleware(new NextRequest(`https://kline.test${path}`, { method: "POST", headers: { cookie: await h.cookie(h.api.labCollaborator, true) } }));
    assert.equal(response.status, 403);
  }
  assert.ok(h.calls.every(call => call.name.startsWith("co_dev_")));
  const response = await h.call({ action: "save", ...draft(), html: "x".repeat(262145) }); assert.equal(response.status, 413);
  assert.equal((await h.call({ action: "get", id: "id);drop table member;--" })).status, 400);
});
