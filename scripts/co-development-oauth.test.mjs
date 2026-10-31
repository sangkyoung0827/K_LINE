import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { coDevelopmentHarness } from "./co-development-harness.mjs";

const origin = "https://kline.test", api = `${origin}/api/co-development`, oauth = `${api}/oauth`, resource = `${api}/mcp`;
const callback = "https://chatgpt.com/connector_platform_oauth_redirect";
const alice = "oauth-alice@example.test", bob = "oauth-bob@example.test";
const hash = value => createHash("sha256").update(value).digest("hex");
let h;
before(async () => { h = await coDevelopmentHarness(); });
after(async () => { await h?.close(); });
async function request(url, options = {}) { return h.handle(new NextRequest(url, options)); }
async function register(method = "none") {
  const response = await request(`${oauth}/register`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Synthetic MCP client", redirect_uris: [callback], token_endpoint_auth_method: method }) });
  const data = await response.json(); assert.equal(response.status, 201, JSON.stringify(data)); return data;
}
async function begin(client, overrides = {}) {
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: callback, response_type: "code", resource,
    scope: "lab:develop", code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), state: randomUUID(), ...overrides });
  const response = await request(`${oauth}/authorize?${params}`);
  assert.equal(response.status, 303, await response.clone().text());
  return { verifier, params, response, id: new URL(response.headers.get("location")).searchParams.get("request"), csrf: response.headers.get("set-cookie")?.split(";")[0] };
}
async function consent(flow, email = alice, approve = true, headers = {}) {
  const cookie = `${await h.cookie(email, true)}; ${flow.csrf}`;
  return request(`${oauth}/consent`, { method: "POST", headers: { origin, cookie, "Content-Type": "application/json", ...headers }, body: JSON.stringify({ request: flow.id, approve, email: bob }) });
}
async function authorized(client, email = alice) {
  const flow = await begin(client);
  const response = await consent(flow, email);
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
  const redirect = new URL(result.redirect);
  assert.equal(redirect.origin, "https://chatgpt.com"); assert.equal(redirect.searchParams.get("iss"), origin); assert.equal(redirect.searchParams.get("state"), flow.params.get("state"));
  return { ...flow, code: redirect.searchParams.get("code") };
}
async function token(client, values = {}, headers = {}) {
  return request(`${oauth}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams({ client_id: client.client_id, resource, ...values }) });
}
async function exchange(client, flow) {
  const response = await token(client, { grant_type: "authorization_code", code: flow.code, code_verifier: flow.verifier, redirect_uri: callback,
    ...(client.client_secret ? { client_secret: client.client_secret } : {}) });
  const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
}
async function mcp(access, name = "lab_list", args = {}) {
  const client = new Client({ name: "oauth-isolation-qa", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(resource), { requestInit: { headers: { Authorization: `Bearer ${access}` } }, fetch: (url, init) => request(url, init) });
  try { await client.connect(transport); return await client.callTool({ name, arguments: args }); }
  finally { await client.close(); }
}

test("anonymous MCP challenge discovers public metadata, strict scope and S256 without exposing any workspace", async () => {
  const response = await request(resource, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(response.status, 401); assert.match(response.headers.get("www-authenticate"), /oauth-protected-resource\/api\/co-development\/mcp/);
  const prm = await (await request(`${origin}/.well-known/oauth-protected-resource/api/co-development/mcp`)).json();
  assert.equal(prm.resource, resource); assert.deepEqual(prm.authorization_servers, [origin]);
  const meta = await (await request(`${origin}/.well-known/oauth-authorization-server`)).json();
  assert.deepEqual(meta.code_challenge_methods_supported, ["S256"]); assert.equal(meta.client_id_metadata_document_supported, true);
  assert.deepEqual(meta.scopes_supported, ["lab:develop"]); assert.equal(meta.authorization_response_iss_parameter_supported, true);
  assert.equal((await request(`${api}/oauth/connections`)).status, 401);
});

test("explicit own-account consent creates a private workspace with no owner, review or deploy authority", async () => {
  const client = await register(), flow = await authorized(client), tokens = await exchange(client, flow);
  assert.match(tokens.access_token, /^kla_[a-f0-9]{64}$/); assert.match(tokens.refresh_token, /^klr_[a-f0-9]{64}$/);
  assert.deepEqual((await mcp(tokens.access_token)).structuredContent.result.projects, []);
  const id = randomUUID();
  const saved = await mcp(tokens.access_token, "lab_save_bundle", { id, expectedRevision: 0, title: "OAuth isolated fixture", description: "Not operating data", html: "<button>Preview</button>", fixture: {}, files: { "main.js": "console.log('isolated')" } });
  assert.equal(saved.isError, undefined); assert.equal(saved.structuredContent.result.project.created_by, alice);
  const bobClient = await register(), bobTokens = await exchange(bobClient, await authorized(bobClient, bob));
  const denied = await mcp(bobTokens.access_token, "lab_get", { id }); assert.equal(denied.isError, true);
  for (const action of ["review", "release", "owner_projects", "token_rotate", "state_read"]) {
    assert.equal((await h.call({ action, id, expectedRevision: 1 }, null, { url: api, headers: { Authorization: `Bearer ${tokens.access_token}` } })).status, 403);
  }
  assert.equal((await h.call({action:"list"},null,{url:`${api}/actions`,headers:{Authorization:`Bearer ${tokens.access_token}`}})).status,403);
  const rows = (await h.db.query("select access_hash,refresh_hash from co_dev_oauth_tokens where access_hash=$1",[hash(tokens.access_token)])).rows;
  assert.equal(rows.length,1); assert.equal(rows[0].refresh_hash,hash(tokens.refresh_token));
  assert.ok(!JSON.stringify(rows).includes(tokens.access_token));
  for (const op of ["deploy", "release", "review"]) assert.equal((await mcp(tokens.access_token, op)).isError, true);
});

test("consent requires a real session, same-origin POST, matching nonce, and cannot be replayed", async () => {
  const client = await register(), flow = await begin(client);
  assert.match(flow.response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/); assert.match(flow.response.headers.get("set-cookie"), /Secure/);
  assert.equal((await request(`${oauth}/consent?request=${flow.id}`, {headers:{cookie:await h.cookie(alice,true)}})).status,400);
  assert.equal((await request(`${oauth}/consent`,{method:"POST",headers:{"Content-Type":"application/json",origin,cookie:flow.csrf},body:JSON.stringify({request:flow.id,approve:true})})).status,401);
  assert.notEqual((await consent(flow,alice,true,{origin:"https://evil.test"})).status,200);
  const other = await begin(client); assert.equal((await consent({...flow,csrf:other.csrf})).status,400);
  const detail = await (await request(`${oauth}/consent?request=${flow.id}`, {headers:{cookie:`${await h.cookie(alice,true)}; ${flow.csrf}`}})).json();
  assert.equal(detail.email,alice); assert.equal(detail.redirectUri,callback);
  assert.equal((await consent(flow)).status,200); assert.equal((await consent(flow)).status,400);
});

test("cancel returns state and issuer without issuing a grant or token", async () => {
  const client = await register(), flow = await begin(client), response = await consent(flow,alice,false);
  const target = new URL((await response.json()).redirect);
  assert.equal(target.searchParams.get("error"),"access_denied");assert.equal(target.searchParams.get("iss"),origin);assert.equal(target.searchParams.get("state"),flow.params.get("state"));
  assert.equal((await h.db.query("select grant_id from co_dev_oauth_requests where id=$1",[flow.id])).rows[0].grant_id,null);
});

test("PKCE, redirect, client and resource binding reject substitution; consumed codes revoke their grant on replay", async () => {
  const client = await register(), other = await register(), flow = await authorized(client);
  const good={grant_type:"authorization_code",code:flow.code,code_verifier:flow.verifier,redirect_uri:callback};
  for (const [c,overrides] of [[client,{code_verifier:"a".repeat(43)}],[client,{redirect_uri:"https://evil.test"}],[other,{}],[client,{resource:`${origin}/api/co-development/actions`}]]) {
    const response=await token(c,{...good,...overrides});assert.equal(response.status,400);
  }
  const tokens=await exchange(client,flow);await mcp(tokens.access_token);
  assert.equal((await token(client,good)).status,400);
  await assert.rejects(mcp(tokens.access_token));
});

test("refresh rotation, replay revocation, expiry and per-user disconnection invalidate OAuth but not legacy keys", async () => {
  const client=await register(),tokens=await exchange(client,await authorized(client));
  const response=await token(client,{grant_type:"refresh_token",refresh_token:tokens.refresh_token});assert.equal(response.status,200);const next=await response.json();
  await mcp(next.access_token);
  assert.equal((await token(client,{grant_type:"refresh_token",refresh_token:tokens.refresh_token})).status,400);
  await assert.rejects(mcp(next.access_token));
  const fresh=await exchange(client,await authorized(client));
  const list=await (await request(`${oauth}/connections`,{headers:{cookie:await h.cookie(alice,true)}})).json();
  const grant=(await h.db.query("select grant_id from co_dev_oauth_tokens where access_hash=$1",[hash(fresh.access_token)])).rows[0].grant_id;
  assert.ok(list.some(v=>v.id===grant));
  const disconnect=email=>request(`${oauth}/connections`,{method:"POST",headers:{origin,cookie:"", "Content-Type":"application/json"},body:JSON.stringify({id:grant})});
  assert.equal((await disconnect(bob)).status,401);
  const revoke=async email=>h.call({id:grant},email,{url:`${oauth}/connections`});
  assert.equal((await revoke(bob)).status,200);await mcp(fresh.access_token);
  const legacy=await (await h.call({action:"token_rotate"},alice,{url:api})).json();
  assert.equal((await revoke(alice)).status,200);await assert.rejects(mcp(fresh.access_token));
  assert.equal((await h.call({action:"list"},null,{url:`${api}/actions`,headers:{Authorization:`Bearer ${legacy.token}`}})).status,200);
  const expired=await exchange(client,await authorized(client));
  await h.db.exec(`update co_dev_oauth_tokens set access_expires_at=now()-interval '1 second' where access_hash='${hash(expired.access_token)}'`);
  await assert.rejects(mcp(expired.access_token));
  await h.db.exec(`update co_dev_oauth_tokens set refresh_expires_at=now()-interval '1 second' where refresh_hash='${hash(expired.refresh_token)}'`);
  assert.equal((await token(client,{grant_type:"refresh_token",refresh_token:expired.refresh_token})).status,400);
});

test("CIMD supports ChatGPT's plural none/private_key_jwt metadata without arbitrary fetches", async () => {
  const client={client_id:"https://chatgpt.com/oauth/client.json"};
  const tokens=await exchange(client,await authorized(client,bob));await mcp(tokens.access_token);
  for(const id of ["https://127.0.0.1/oauth/client.json","https://chatgpt.com.evil.test/oauth/client.json","https://chatgpt.com/oauth/client.json?x=1","https://evil.test/client.json"]) {
    const response=await request(`${oauth}/authorize?${new URLSearchParams({client_id:id,redirect_uri:callback})}`);assert.equal(response.status,401);
  }
});

test("DCR accepts only registered ChatGPT callbacks and enforces confidential-client authentication", async () => {
  for(const redirect of ["http://chatgpt.com/connector_platform_oauth_redirect","https://evil.test/callback",`${callback}?next=evil`,"https://chatgpt.com@evil.test/connector_platform_oauth_redirect"]) {
    const response=await request(`${oauth}/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({redirect_uris:[redirect]})});assert.equal(response.status,400);
  }
  const client=await register("client_secret_post"),flow=await authorized(client);
  const fields={grant_type:"authorization_code",code:flow.code,code_verifier:flow.verifier,redirect_uri:callback};
  assert.equal((await token(client,fields)).status,401);
  assert.equal((await token(client,{...fields,client_secret:"wrong"})).status,401);
  await exchange(client,flow);
  const basic=await register("client_secret_basic"),basicFlow=await authorized(basic);
  const response=await token(basic,{grant_type:"authorization_code",code:basicFlow.code,code_verifier:basicFlow.verifier,redirect_uri:callback},{Authorization:`Basic ${Buffer.from(`${basic.client_id}:${basic.client_secret}`).toString("base64")}`});
  assert.equal(response.status,200);
});

test("official MCP SDK performs discovery, DCR, S256 exchange, initialization and private tool calls", async () => {
  let info,tokens,verifier,authorizeUrl;
  const provider={redirectUrl:callback,clientMetadata:{redirect_uris:[callback],client_name:"SDK OAuth fixture",token_endpoint_auth_method:"none",grant_types:["authorization_code","refresh_token"],response_types:["code"]},
    clientInformation:()=>info,saveClientInformation:value=>{info=value},tokens:()=>tokens,saveTokens:value=>{tokens=value},
    redirectToAuthorization:url=>{authorizeUrl=url},saveCodeVerifier:value=>{verifier=value},codeVerifier:()=>verifier};
  const fetchFn=(url,init)=>request(url,init);
  assert.equal(await auth(provider,{serverUrl:resource,fetchFn}),"REDIRECT");
  const response=await request(authorizeUrl);assert.equal(response.status,303);
  const flow={id:new URL(response.headers.get("location")).searchParams.get("request"),csrf:response.headers.get("set-cookie").split(";")[0]};
  const target=new URL((await (await consent(flow,bob)).json()).redirect);
  assert.equal(await auth(provider,{serverUrl:resource,fetchFn,authorizationCode:target.searchParams.get("code")}),"AUTHORIZED");
  assert.equal((await mcp(tokens.access_token)).isError,undefined);
  const toolResponse=await request(resource,{method:"POST",headers:{Authorization:`Bearer ${tokens.access_token}`,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},body:JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list"})});
  const listed=(await toolResponse.json()).result.tools;
  assert.equal(listed.length,9);assert.ok(listed.every(tool=>tool.securitySchemes[0].type==="oauth2"&&tool.securitySchemes[0].scopes[0]==="lab:develop"));
  assert.ok(listed.every(tool=>JSON.stringify(tool.securitySchemes)===JSON.stringify(tool._meta.securitySchemes)));
});

test("new OAuth tables and RPC reject anonymous/authenticated database roles", async () => {
  for(const role of ["anon","authenticated"]) {
    await h.db.exec(`reset role;set role ${role}`);
    try {
      for(const table of ["clients","requests","grants","tokens","limits"])await assert.rejects(h.db.query(`select * from co_dev_oauth_${table}`),/permission denied/);
      await assert.rejects(h.db.query("select co_dev_oauth('connections','{}'::jsonb)"),/permission denied/);
    }finally{await h.db.exec("reset role;set role service_role");}
  }
  const checked=(await h.db.query("select relname,relrowsecurity from pg_class where relname like 'co_dev_oauth_%' and relkind='r'")).rows;
  assert.equal(checked.length,5);assert.ok(checked.every(row=>row.relrowsecurity));
});

test("expired requests/codes, widened scopes, duplicate parameters and malformed bodies fail closed", async () => {
  const client=await register(),pending=await begin(client);
  await h.db.query("update co_dev_oauth_requests set expires_at=now()-interval '1 second' where id=$1",[pending.id]);
  assert.equal((await consent(pending)).status,400);
  const flow=await authorized(client);
  await h.db.query("update co_dev_oauth_requests set expires_at=now()-interval '1 second' where id=$1",[flow.id]);
  assert.equal((await token(client,{grant_type:"authorization_code",code:flow.code,code_verifier:flow.verifier,redirect_uri:callback})).status,400);
  const denied=await begin(client,{scope:"lab:develop owner:publish"});
  assert.equal(new URL(denied.response.headers.get("location")).searchParams.get("error"),"invalid_scope");
  const response=await request(`${oauth}/authorize?client_id=${client.client_id}&client_id=other&redirect_uri=${encodeURIComponent(callback)}`);assert.equal(response.status,400);
  const malformed=await request(`${oauth}/connections`,{method:"POST",headers:{origin,cookie:await h.cookie(alice,true),"Content-Type":"application/json"},body:"null"});assert.equal(malformed.status,400);
  for(const field of ["access_token","refresh_token"]) {
    const tokens=await exchange(client,await authorized(client));
    const revoked=await request(`${oauth}/revoke`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:client.client_id,token:tokens[field]})});
    assert.equal(revoked.status,200);await assert.rejects(mcp(tokens.access_token));
  }
  const framed=await h.api.middleware(new NextRequest(`${origin}/co-development/connect?request=${randomUUID()}`,{headers:{cookie:await h.cookie(alice,true)}}));
  assert.equal(framed.headers.get("x-frame-options"),"DENY");assert.equal(framed.headers.get("content-security-policy"),"frame-ancestors 'none'");
});

test("durable rate budgets reject excess calls and sensitive OAuth values cannot be stored in source", async () => {
  const op=async()=>h.db.query("select co_dev_oauth('limit',$1::jsonb) as result",[JSON.stringify({key:"isolated-budget",max:2})]);
  assert.equal((await op()).rows[0].result,true);assert.equal((await op()).rows[0].result,true);assert.equal((await op()).rows[0].result,false);
  await h.db.exec("update co_dev_oauth_limits set expires_at=now()-interval '1 second' where key='isolated-budget'");
  assert.equal((await op()).rows[0].result,true);
  for(const prefix of ["kla","klr","klsecret","klcode"])assert.throws(()=>h.api.labNoSecrets(`${prefix}_${"a".repeat(64)}`),/SOURCE_CONTAINS_CREDENTIAL/);
});
