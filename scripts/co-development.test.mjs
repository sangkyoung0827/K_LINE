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

test("any signed-in account can enter; email-like input alone never authenticates an API request", () => {
  for (const email of [h.api.labOwner, h.api.labCollaborator, ` ${h.api.labCollaborator.toUpperCase()} `,"member@example.test","other-admin@example.test"]) assert.equal(h.api.canUseCoDevelopment(email), true);
  for (const email of [null, "", "invalid", "member @example.test"]) assert.equal(h.api.canUseCoDevelopment(email), false);
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

test("members enter empty isolated workspaces; anonymous and spoofed identities cannot access prototypes", async () => {
  for (const email of ["member@example.test", "other-developer@example.test"]) {
    assert.deepEqual((await ok({action:"list"},email)).projects,[]);
    const { appearance } = await ok({action:"settings_get"},email);
    assert.equal(appearance.background, "#F4EBDD");
    assert.equal(appearance.foreground, "#1F2A44");
    assert.equal(appearance.accent, "#D6A85A");
  }
  for (const email of [null]) {
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
  assert.deepEqual(schema.paths["/api/co-development/actions"].post.requestBody.content["application/json"].schema.properties.action.enum, ["list", "get", "save", "bundle_save", "source_get", "records_list", "record_save", "settings_get", "settings_save"]);
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
  for (const email of [null]) {
    assert.ok([401, 403].includes((await h.call({ action: "settings_get" }, email)).status));
    const response = await h.handle(new NextRequest("https://kline.test/api/co-development/card", { headers: email ? { cookie: await h.cookie(email, true) } : {} }));
    assert.ok([401, 403].includes(response.status));
  }
  for (const email of ["member@example.test", "developer@example.test"]) {
    const settings = await ok({action:"settings_get"},email);
    assert.equal(settings.version,0); assert.equal(settings.appearance.cardHtml,"");
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
    for(const email of [null,"member@example.test","developer@example.test"]) assert.ok([401,403,404].includes((await h.call(request,email)).status));
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
    assert.match(client.getInstructions(),/First call lab_list/);
    assert.match(client.getInstructions(),/START-HERE.md from lab_starter/);
    const tools = (await client.listTools()).tools.map(item=>item.name);
    assert.deepEqual(tools.sort(),["lab_starter","lab_list","lab_get","lab_save_bundle","lab_source","lab_settings","lab_customize","lab_records","lab_save_record"].sort());
    const call = async (name,args={}) => { const result=await client.callTool({name,arguments:args}); assert.notEqual(result.isError,true,JSON.stringify(result)); return result.structuredContent.result; };
    const starter = await call("lab_starter"); assert.match(starter.files["README.md"], /bearer_token_env_var/); assert.match(starter.files["src/main.js"], /KLINE_LAB.records/);
    assert.match(starter.files["START-HERE.md"],/## START HERE/);
    assert.match(starter.files["START-HERE.md"],/Register the ChatGPT plugin/);
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

test("GPT start file is authenticated, complete, origin-bound and never contains a connection key",async()=>{
  const issued=await ok({action:"token_rotate"},"onboarding@example.test");
  for(const path of ["onboarding","schema?download=1"]){
    const response=await publicGet(path,"onboarding@example.test");
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");assert.match(response.headers.get("content-disposition"),/attachment/);
    const text=await response.text();assert.ok(!text.includes(issued.token));assert.ok(!/sk-(?:proj-)?[a-zA-Z0-9_-]{32,}/.test(text));
    if(path==="onboarding"){
      assert.match(text,/https:\/\/kline.test\/api\/co-development\/mcp/);assert.match(text,/does not install tools/);assert.match(text,/NOT an OpenAI API key/);assert.match(text,/including drafts/);assert.match(text,/cannot submit, approve, publish/);
      const schema=JSON.parse(text.match(/```json\n([\s\S]*?)\n```/)[1]);assert.equal(schema.servers[0].url,"https://kline.test");assert.deepEqual(Object.keys(schema.paths),["/api/co-development/actions"]);
    }
    assert.equal((await publicGet(path,null)).status,401);
    const bearer=await h.handle(new NextRequest(`https://kline.test/api/co-development/${path}`,{headers:{authorization:`Bearer ${issued.token}`}}));assert.equal(bearer.status,403);
  }
  const zip=await JSZip.loadAsync(await (await publicGet("starter","onboarding@example.test")).arrayBuffer());
  assert.equal(await zip.file("START-HERE.md").async("string"),await (await publicGet("onboarding","onboarding@example.test")).text());
  assert.equal(JSON.parse(await zip.file("openapi.json").async("string")).servers[0].url,"https://kline.test");
  const local=await h.handle(new NextRequest("http://localhost:3365/api/co-development/onboarding",{headers:{cookie:await h.cookie("onboarding@example.test")}}));assert.match(await local.text(),/not reachable by a remote GPT/);
});

test("guided start leads from unconnected ChatGPT through installation, real verification and first requested feature",async()=>{
  const beforeCalls=h.calls.length;
  const response=await publicGet("onboarding","setup-guide@example.test");assert.equal(response.status,200);
  const guide=await response.text();
  assert.ok(guide.indexOf("## START HERE")<guide.indexOf("## Read this first"));
  for(const language of ["ko","en"]){
    const prompt=h.api.labSetupPrompt("https://kline.test",language);
    assert.ok(guide.includes(prompt));assert.ok(prompt.includes("https://kline.test/api/co-development/mcp"));
    const positions=["PREPARE","REGISTER","CONSENT","INSTALL","VERIFY","BUILD","REVIEW"].map(stage=>prompt.indexOf(stage));
    assert.ok(positions.every((position,i)=>position>=0&&(!i||position>positions[i-1])));
    for(const text of ["https://chatgpt.com/plugins","OAuth","Create as a plugin","lab_list","lab_save_bundle","lab_get"])assert.ok(prompt.includes(text),text);
  }
  assert.match(guide,/one action to take now and one confirmation question/);
  assert.match(guide,/registration alone is not installation|Registration alone is not installation/);
  assert.match(guide,/new conversation.*@/s);assert.match(guide,/An empty projects array is valid/);
  assert.match(guide,/An attachment or my saying 'done' is not proof/);
  assert.match(guide,/Do not create sample projects or test data before my request/);
  assert.match(guide,/No authentication/);assert.match(guide,/user chooses that alternative/);
  assert.match(guide,/Do not complete consent for them/);assert.match(guide,/External GPTs cannot submit reviews, approve, publish/);
  assert.equal(h.calls.length,beforeCalls,"reading setup instructions must not save projects, rotate keys or change grants");
  const zip=await JSZip.loadAsync(await (await publicGet("starter","setup-guide@example.test")).arrayBuffer());
  assert.equal(await zip.file("START-HERE.md").async("string"),guide);
});

test("guided commands remain origin-bound, secret-free and honest about localhost and unsupported accounts",()=>{
  for(const language of ["ko","en"]){
    const local=h.api.labSetupPrompt("http://localhost:3365",language);
    assert.ok(local.includes("http://localhost:3365/api/co-development/mcp"));
    assert.match(local,/로컬 미리보기|LOCAL PREVIEW/);assert.ok(!local.includes("https://kline-nine-wheat.vercel.app"));
    const publicPrompt=h.api.labSetupPrompt("https://kline.test/nested?ignored=yes",language);
    assert.ok(!publicPrompt.includes("nested"));assert.ok(!publicPrompt.includes("ignored"));
    assert.doesNotMatch(publicPrompt,/\b(?:kll|kla|klr|sk-proj)_[a-f0-9]{32,}\b/);
  }
  const prompt=h.api.labSetupPrompt("https://kline.test","en");
  assert.match(prompt,/account\/workspace policy blocks custom MCP/);
  assert.match(prompt,/I must complete installation, login and permission consent myself/);
  assert.match(prompt,/Do not overwrite existing work without approval/);
});

test("owner inspects all saved drafts and immutable source but members and GPT keys cannot cross tenants or release",async()=>{
  const author="oversight-author@example.test",other="oversight-other@example.test";
  const input={...draft(),action:"bundle_save",title:"Owner oversight draft",files:{"src/main.js":"console.log('local only')"}};
  await ok(input,author);const saved=await ok({action:"get",id:input.id},author),revisionId=saved.revisions[0].id;
  const listing=await ok({action:"owner_projects"},h.api.labOwner);assert.ok(listing.projects.some(p=>p.id===input.id));assert.ok(listing.projects.every(p=>p.html===undefined&&p.fixture===undefined));
  const detail=await ok({action:"owner_project",id:input.id},h.api.labOwner);assert.equal(detail.project.created_by,author);assert.equal(detail.revision.html,input.html);assert.deepEqual(detail.source.files,input.files);
  assert.equal((await ok({action:"review_queue"},h.api.labOwner)).some(r=>r.project_id===input.id),false);
  const preview=await publicGet(`owner-preview/${revisionId}`,h.api.labOwner);assert.equal(preview.status,200);assert.match(preview.headers.get("content-security-policy"),/connect-src 'none'/);assert.match(preview.headers.get("content-security-policy"),/sandbox allow-scripts/);
  for(const email of [author,other,h.api.labCollaborator,null]){
    for(const body of [{action:"owner_projects"},{action:"owner_project",id:input.id}])assert.ok([401,403].includes((await h.call(body,email)).status));
    assert.ok([401,403].includes((await publicGet(`owner-preview/${revisionId}`,email)).status));
  }
  const key=await ok({action:"token_rotate"},h.api.labOwner);const options={url:"https://kline.test/api/co-development/actions",headers:{authorization:`Bearer ${key.token}`}};
  for(const action of ["owner_projects","owner_project","review_decide","release"])assert.equal((await h.call({action,id:input.id},null,options)).status,403);
  assert.equal((await h.handle(new NextRequest(`https://kline.test/api/co-development/owner-preview/${revisionId}`,{headers:options.headers}))).status,403);
  await ok({...input,expectedRevision:1,html:"<p>New revision</p>"},author);
  const old=await ok({action:"owner_project",id:input.id,revisionId},h.api.labOwner);assert.equal(old.revision.html,input.html);
  const notThisProject=await ok(draft(),other);const foreign=await ok({action:"get",id:notThisProject.project.id},other);
  assert.equal((await h.call({action:"owner_project",id:input.id,revisionId:foreign.revisions[0].id},h.api.labOwner)).status,404);
  await ok({action:"review",id:input.id,expectedRevision:2},author);
  const submitted=(await ok({action:"review_queue"},h.api.labOwner)).find(r=>r.project_id===input.id);
  await ok({action:"review_decide",id:submitted.id,approve:true,note:"Reviewed code and test preview"},h.api.labOwner);
  assert.ok(!(await (await publicGet("catalog",null)).json()).some(p=>p.id===input.id));
  await ok({action:"release",id:submitted.id,expectedVersion:0,publish:true},h.api.labOwner);
  assert.ok((await (await publicGet("catalog",null)).json()).some(p=>p.id===input.id));
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

const alice = "alice@example.test", bob = "bob@example.test";
async function publicGet(path, email) {
  return h.handle(new NextRequest(`https://kline.test/api/co-development/${path}`, { headers: email ? {cookie:await h.cookie(email,true)} : {} }));
}
async function dataCall(projectId, body, email = alice, headers = {}) {
  return h.call(body,email,{url:`https://kline.test/api/co-development/service/${projectId}/data`,headers});
}

test("tenant guards cover every project, revision, source, state, record and settings entry point", async () => {
  const input = {...draft(),action:"bundle_save",files:{"main.js":"console.log('hello')"}};
  const saved = await ok(input,alice);
  const rid = saved.revisionId;
  const recordId = randomUUID();
  await ok({action:"record_save",projectId:input.id,collection:"events",id:recordId,data:{title:"Synthetic"},expectedVersion:0},alice);
  const forbidden = [
    {action:"get",id:input.id},{action:"revision",revisionId:rid},{action:"source_get",revisionId:rid},
    {action:"state_read",revisionId:rid},{action:"state_save",revisionId:rid,data:{},expectedVersion:0},
    {action:"records_list",projectId:input.id,collection:"events"},
    {action:"record_save",projectId:input.id,collection:"events",id:recordId,data:{},expectedVersion:1},
    {...input,expectedRevision:1},{...input,expectedRevision:0},{action:"review",id:input.id,expectedRevision:1}
  ];
  for (const email of [bob,h.api.labCollaborator,h.api.labOwner]) {
    assert.ok(!(await ok({action:"list"},email)).projects.some(p=>p.id===input.id));
    for (const body of forbidden) assert.equal((await h.call(body,email)).status,404,`${email} ${body.action}`);
    assert.equal((await publicGet(`preview/${rid}`,email)).status,404);
  }
  const settings=await ok({action:"settings_get"},alice);
  await ok({action:"settings_save",appearance:{...settings.appearance,title:"Alice",landingProjectId:input.id},expectedVersion:settings.version},alice);
  assert.notEqual((await ok({action:"settings_get"},bob)).appearance.title,"Alice");
  assert.equal((await h.call({action:"settings_save",appearance:{...settings.appearance,landingProjectId:input.id},expectedVersion:0},bob)).status,404);
  assert.equal((await ok({action:"get",id:input.id},alice)).project.revision,1);
});

test("ordinary account GPT Actions can save real source bundles and data but never review or release", async () => {
  const {token}=await ok({action:"token_rotate"},bob);
  const options={url:"https://kline.test/api/co-development/actions",headers:{authorization:`Bearer ${token}`}};
  const input={...draft(),action:"bundle_save",files:{"main.js":"document.title='Bob'"}};
  const saved=await ok(input,null,options);
  const source=await ok({action:"source_get",revisionId:saved.revisionId},null,options);
  assert.deepEqual(source.files,input.files);
  await ok({action:"record_save",projectId:input.id,collection:"tasks",id:randomUUID(),data:{done:false},expectedVersion:0},null,options);
  const page=await ok({action:"records_list",projectId:input.id,collection:"tasks"},null,options);assert.equal(page.records.length,1);
  for(const action of ["review","review_queue","review_detail","review_decide","release","token_rotate","service_data","sql","deploy"]) assert.equal((await h.call({action,id:input.id,publish:true,approve:true},null,options)).status,403);
  const aliceProject=(await ok({action:"list"},alice)).projects[0];
  assert.equal((await h.call({action:"get",id:aliceProject.id},null,options)).status,404);
  await ok({action:"token_revoke"},bob);
  assert.equal((await h.call({action:"list"},null,options)).status,403);
});

test("owner reviews immutable source and preview; stale submissions cannot be approved or published", async () => {
  const input={...draft(),action:"bundle_save",files:{"main.js":"v1"}};const saved=await ok(input,alice);
  await ok({action:"review",id:input.id,expectedRevision:1},alice);
  const queue=await ok({action:"review_queue"},h.api.labOwner);const item=queue.find(q=>q.project_id===input.id);
  assert.ok(item);assert.equal(item.state,"pending");
  const detail=await ok({action:"review_detail",id:item.id},h.api.labOwner);
  assert.equal(detail.revision.html,input.html);assert.deepEqual(detail.source.files,input.files);
  const preview=await publicGet(`review-preview/${item.id}`,h.api.labOwner);assert.equal(preview.status,200);assert.match(preview.headers.get("content-security-policy"),/sandbox allow-scripts/);
  for(const email of [alice,bob,h.api.labCollaborator,null]) {
    assert.ok([401,403].includes((await h.call({action:"review_queue"},email)).status));
    assert.ok([401,403].includes((await publicGet(`review-preview/${item.id}`,email)).status));
    assert.ok([401,403].includes((await h.call({action:"review_decide",id:item.id,approve:true,note:"spoof"},email)).status));
  }
  assert.equal((await h.call({action:"release",id:item.id,expectedVersion:0,publish:true},h.api.labOwner)).status,400);
  const issued=await ok({action:"token_rotate"},h.api.labOwner);
  assert.equal((await h.call({action:"review_decide",id:item.id,approve:true,note:"invalid channel"},null,{headers:{authorization:`Bearer ${issued.token}`}})).status,403);
  await ok({...input,expectedRevision:1,html:"<p>v2</p>"},alice);
  assert.equal((await h.call({action:"review_decide",id:item.id,approve:true,note:"stale"},h.api.labOwner)).status,409);
  assert.equal((await ok({action:"review_detail",id:item.id},h.api.labOwner)).revision.html,saved.project.html);
  assert.equal((await publicGet(`service/${input.id}`)).status,404);
});

test("approval and publication are separate; only the approved revision becomes a public card", async () => {
  const input={...draft(),title:"Approved service",description:"Synthetic service",html:"<h1>Approved v1</h1>"};await ok(input,alice);
  await ok({action:"review",id:input.id,expectedRevision:1},alice);
  const item=(await ok({action:"review_queue"},h.api.labOwner)).find(q=>q.project_id===input.id);
  await ok({action:"review_decide",id:item.id,approve:true,note:"Reviewed source and functionality"},h.api.labOwner);
  assert.equal((await publicGet(`service/${input.id}`)).status,404);
  const published=await ok({action:"release",id:item.id,expectedVersion:0,publish:true},h.api.labOwner);assert.equal(published.version,1);
  const catalog=await (await publicGet("catalog")).json();const card=catalog.find(p=>p.id===input.id);assert.equal(card.title,input.title);
  for(const key of ["created_by","fixture","html","source"])assert.equal(card[key],undefined);
  const page=await publicGet(`service/${input.id}`);assert.match(await page.text(),/Approved v1/);assert.equal(page.headers.get("cache-control"),"private, no-store");
  await ok({...input,expectedRevision:1,html:"<h1>UNAPPROVED v2</h1>",title:"Unapproved service"},alice);
  const unchanged=await (await publicGet(`service/${input.id}`)).text();assert.match(unchanged,/Approved v1/);assert.doesNotMatch(unchanged,/UNAPPROVED/);
  assert.equal((await h.call({action:"release",id:item.id,expectedVersion:1,publish:true},h.api.labOwner)).status,409);
  await ok({action:"release",id:item.id,expectedVersion:1,publish:false},h.api.labOwner);
  assert.equal((await publicGet(`service/${input.id}`)).status,404);
  assert.equal((await dataCall(input.id,{action:"state_read"})).status,404);
});

test("published data is partitioned per signed-in visitor and never copies author test records", async () => {
  const input={...draft(),fixture:{secret:"synthetic-only-private-fixture"}};await ok(input,alice);
  await ok({action:"record_save",projectId:input.id,collection:"tasks",id:randomUUID(),data:{privateTest:true},expectedVersion:0},alice);
  await ok({action:"review",id:input.id,expectedRevision:1},alice);
  const item=(await ok({action:"review_queue"},h.api.labOwner)).find(q=>q.project_id===input.id);
  await ok({action:"review_decide",id:item.id,approve:true,note:"Reviewed"},h.api.labOwner);
  await ok({action:"release",id:item.id,expectedVersion:0,publish:true},h.api.labOwner);
  const initial=await (await dataCall(input.id,{action:"state_read"})).json();assert.deepEqual(initial,{data:{},version:0});
  assert.equal((await dataCall(input.id,{action:"state_read"},null)).status,401);
  assert.equal((await dataCall(input.id,{action:"state_read"},alice,{origin:"https://evil.test"})).status,403);
  const token=await ok({action:"token_rotate"},alice);
  assert.equal((await dataCall(input.id,{action:"state_read"},null,{authorization:`Bearer ${token.token}`})).status,403);
  const recordId=randomUUID();
  const saved=await dataCall(input.id,{action:"record_save",collection:"tasks",id:recordId,expectedVersion:0,data:{text:"Alice live task"},actor:bob,projectId:randomUUID()});assert.equal(saved.status,200);
  const mine=await (await dataCall(input.id,{action:"records_list",collection:"tasks"})).json();assert.equal(mine.records.length,1);assert.equal(mine.records[0].data.text,"Alice live task");assert.equal(mine.records[0].actor,undefined);
  const theirs=await (await dataCall(input.id,{action:"records_list",collection:"tasks"},bob)).json();assert.deepEqual(theirs.records,[]);
  assert.equal((await dataCall(input.id,{action:"record_save",collection:"tasks",id:recordId,expectedVersion:1,data:{bad:true}},bob)).status,409);
  assert.equal((await dataCall(input.id,{action:"record_save",collection:"tasks",id:recordId,expectedVersion:0,data:{bad:true}})).status,409);
  assert.equal((await dataCall(input.id,{action:"record_save",collection:"tasks",id:recordId,expectedVersion:1,data:{text:"Archived"},archived:true})).status,200);
  assert.deepEqual((await (await dataCall(input.id,{action:"records_list",collection:"tasks"})).json()).records,[]);
  assert.equal((await dataCall(input.id,{action:"state_save",data:{count:1},expectedVersion:0})).status,200);
  const largeState={text:"x".repeat(50000)};
  assert.equal((await dataCall(input.id,{action:"state_save",data:largeState,expectedVersion:1})).status,200);
  assert.deepEqual((await (await dataCall(input.id,{action:"state_read"})).json()).data,largeState);
  assert.equal((await dataCall(input.id,{action:"state_save",data:{text:"x".repeat(65536)},expectedVersion:2})).status,413);
  assert.deepEqual((await (await dataCall(input.id,{action:"state_read"},bob)).json()).data,{});
  const bad=await dataCall(input.id,{action:"record_save",collection:"../members",id:recordId,expectedVersion:0,data:{}});assert.equal(bad.status,400);
});

test("rejected submissions do not publish; missing review notes and embedded credentials fail closed", async () => {
  const input=draft();await ok(input,bob);await ok({action:"review",id:input.id,expectedRevision:1},bob);
  const item=(await ok({action:"review_queue"},h.api.labOwner)).find(q=>q.project_id===input.id);
  assert.equal((await h.call({action:"review_decide",id:item.id,approve:true,note:""},h.api.labOwner)).status,400);
  await ok({action:"review_decide",id:item.id,approve:false,note:"Needs changes"},h.api.labOwner);
  assert.equal((await h.call({action:"release",id:item.id,expectedVersion:0,publish:true},h.api.labOwner)).status,400);
  assert.equal((await publicGet(`service/${input.id}`)).status,404);
  assert.equal((await h.call({...draft(),html:`<p>kll_${"a".repeat(64)}</p>`},bob)).status,400);
  assert.equal((await h.call({...draft(),fixture:{key:`sk-proj-${"x".repeat(40)}`}},bob)).status,400);
});

test("additive migration is repeatable, preserves legacy data and keeps every table/RPC private", async () => {
  const count=(await h.db.query("select count(*) as n from co_dev_projects")).rows[0].n;
  const old=await ok({action:"list"},h.api.labCollaborator);
  await h.db.exec("reset role");
  try { await h.db.exec(await readFile("supabase/migrations/20261026174659_developer_studio.sql","utf8")); } finally { await h.db.exec("set role service_role"); }
  assert.equal((await h.db.query("select count(*) as n from co_dev_projects")).rows[0].n,count);
  assert.deepEqual(await ok({action:"list"},h.api.labCollaborator),old);
  for(const role of ["anon","authenticated"]) {
    await h.db.exec(`set role ${role}`);
    try {
      for(const table of ["co_dev_reviews","co_dev_publications","co_dev_release_history","co_dev_user_settings","co_dev_user_settings_history","co_dev_service_records","co_dev_service_writes"]) {
        await assert.rejects(h.db.query(`select * from ${table}`),/permission denied/);
        await assert.rejects(h.db.query(`delete from ${table}`),/permission denied/);
      }
      await assert.rejects(h.db.query("select co_dev_catalog()"),/permission denied/);
      await assert.rejects(h.db.query("select co_dev_internal_get($1,$2)",[h.api.labOwner,old.projects[0].id]),/permission denied/);
    } finally { await h.db.exec("set role service_role"); }
  }
  assert.ok(h.calls.every(call=>!call.name.includes("internal_")));
});
