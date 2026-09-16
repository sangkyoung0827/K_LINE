import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url);
function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process, console, Date, URL, URLSearchParams, Headers, Request, Response, AbortSignal, setTimeout, clearTimeout })((name) => {
      if (name in stubs) return stubs[name];
      if (name === "server-only") return {};
      if (name.startsWith(".") || name.startsWith("@/")) {
        const path = name.startsWith("@/") ? resolve("src", name.slice(2)) : resolve(dirname(file), name);
        if (existsSync(path + ".ts")) return load(path + ".ts");
      }
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}
const copy = (x) => JSON.parse(JSON.stringify(x));
const model = loader()("src/lib/siu/model.ts");
const future = (hours = 24) => new Date(Date.now() + hours * 3600000).toISOString();
const valid = (extra = {}) => ({ title: "Community walk", short_description: "A local walk", description: "Meet and walk together.",
  categories: ["outdoor","local_exploration"], tags: ["Night Walk"], starts_at: future(), ends_at: future(26),
  location_name: "Public park", is_free: true, status: "draft", ...extra });
const normalized = (extra) => copy(model.validateActivity(valid(extra)));
const historySchema = `CREATE TABLE user_activity_records(id uuid primary key,user_id text,source text,activity_id text,activity_instance_id uuid,
 activity_title_snapshot text,activity_date_snapshot timestamptz,eligible_at timestamptz,rating smallint,rated_at timestamptz,dismissed_at timestamptz,created_at timestamptz);`;
async function setup() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;" + historySchema);
  await db.exec(readFileSync("supabase/siu_activity_platform_v1.sql", "utf8"));
  return db;
}
const save = async (db, actor = "creator@example.test", data = normalized(), id = null, action = "save", stamp = null, admin = false) =>
  (await db.query("select * from siu_save_activity($1,$2,$3,$4,$5,$6,$7)", [actor,"Creator",admin,id,action,stamp,JSON.stringify(data)])).rows[0];
const apply = async (db,id,user = "user@example.test",action = "apply",rating = null) =>
  (await db.query("select * from siu_apply($1,$2,$3,$4,$5)", [id,user,"User",action,rating])).rows[0];

test("validation uses exact existing taxonomy, normalizes tags, rejects URLs/invalid dates/fields", () => {
  assert.deepEqual(normalized().tags, ["night_walk"]);
  assert.deepEqual(normalized({ creator_user_key: "victim", role: "developer" }).categories, ["outdoor","local_exploration"]);
  assert.equal("creator_user_key" in normalized({ creator_user_key: "victim" }), false);
  for (const input of [{ categories: ["religion"] },{ categories: [] },{ tags: ["a".repeat(65)] },{ capacity: 0 },{ capacity: "10" },
    { is_free: false, fee_krw: -1 },{ title: "x".repeat(121) },{ starts_at: "tomorrow" },{ ends_at: future(-1) },
    { application_deadline: future(27) },{ status: "hidden" }]) assert.throws(() => normalized(input));
  for (const url of ["javascript:alert(1)","data:text/html,<script/>","vbscript:test","http://example.test","https://user:pass@example.test"]) {
    for (const key of ["cover_image_url","open_chat_url"]) assert.throws(() => normalized({ [key]: url }));
  }
});

test("migration reruns, preserves legacy data, RLS denies direct browser reads/RPCs", async () => {
  const db = await setup();
  try {
    await db.exec("insert into user_activity_records(id,user_id,source) values(gen_random_uuid(),'legacy','ecc');");
    const before = (await db.query("select * from user_activity_records")).rows;
    await db.exec(readFileSync("supabase/siu_activity_platform_v1.sql", "utf8"));
    assert.deepEqual((await db.query("select * from user_activity_records")).rows, before);
    for (const role of ["anon","authenticated"]) {
      await db.exec("set role " + role);
      for (const table of ["siu_roles","siu_activities","siu_activity_applications","siu_activity_summaries","kline_activity_history_v1"]) {
        await assert.rejects(db.query("select * from " + table), /permission denied/);
      }
      await assert.rejects(db.query("select siu_apply(gen_random_uuid(),'x','x','apply',null)"), /permission denied/);
      await assert.rejects(db.query("select siu_set_role('x',5,'y','admin')"), /permission denied/);
      await db.exec("reset role");
    }
    const rows = (await db.query("select relrowsecurity from pg_class where relname in ('siu_roles','siu_activities','siu_activity_applications')")).rows;
    assert.equal(rows.length, 3); assert.ok(rows.every((r) => r.relrowsecurity));
    assert.doesNotMatch(readFileSync("supabase/siu_activity_platform_v1.sql", "utf8"), /(?:alter|drop|delete from|update)\s+(?:table\s+)?(?:public\.)?(?:ecc_|hanhwal_|user_activity_records|activity_preference_)/i);
  } finally { await db.close(); }
});
test("creator publishes own draft, other creator cannot edit, stale writes rejected, moderation cannot be bypassed", async () => {
  const db = await setup();
  try {
    let a = await save(db); assert.equal(a.status, "draft");
    await assert.rejects(save(db, "other@example.test", normalized(), a.id, "save", a.updated_at), /FORBIDDEN/);
    const stale = a.updated_at;
    a = await save(db, undefined, normalized({ status: "published" }), a.id, "save", a.updated_at);
    assert.equal(a.status, "published");
    await assert.rejects(save(db, undefined, normalized(), a.id, "save", stale), /STALE_ACTIVITY/);
    await assert.rejects(save(db, undefined, null, a.id, "hide", a.updated_at), /FORBIDDEN/);
    a = await save(db, "admin@example.test", null, a.id, "hide", a.updated_at, true);
    assert.equal(a.status, "hidden");
    await assert.rejects(save(db, undefined, normalized({ status: "published" }), a.id, "save", a.updated_at), /ACTIVITY_LOCKED/);
    await assert.rejects(apply(db, a.id), /APPLICATION_CLOSED/);
    a = await save(db, "admin@example.test", null, a.id, "unhide", a.updated_at, true);
    assert.equal(a.status, "published");
    a = await save(db, undefined, null, a.id, "close", a.updated_at);
    assert.equal(a.status, "closed");
    await assert.rejects(apply(db, a.id), /APPLICATION_CLOSED/);
    a = await save(db, undefined, null, a.id, "cancel", a.updated_at);
    assert.equal(a.status, "cancelled");
  } finally { await db.close(); }
});
test("capacity, duplicate, deadline, cancellation and reapplication preserve a single interest identity", async () => {
  const db = await setup();
  try {
    const a = await save(db, undefined, normalized({ status: "published", capacity: 1 }));
    const results = await Promise.allSettled([apply(db,a.id,"one@example.test"),apply(db,a.id,"two@example.test")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const first = results.find((r) => r.status === "fulfilled").value;
    await assert.rejects(apply(db,a.id,first.user_key), /ALREADY_APPLIED/);
    const cancelled = await apply(db,a.id,first.user_key,"cancel");
    assert.equal(cancelled.status,"cancelled"); assert.ok(cancelled.cancelled_at);
    const again = await apply(db,a.id,first.user_key);
    assert.equal(again.id,first.id); assert.equal(again.applied_at.toISOString(),first.applied_at.toISOString());
    assert.equal((await db.query("select count(*) n from siu_activity_applications")).rows[0].n,1);
    const expired = await save(db, undefined, normalized({ status: "published", application_deadline: future(-2) }));
    await assert.rejects(apply(db,expired.id), /APPLICATION_CLOSED/);
    assert.match(readFileSync("supabase/siu_activity_platform_v1.sql", "utf8"), /WHERE id=p_activity_id FOR UPDATE/i);
  } finally { await db.close(); }
});
test("SIU role hierarchy isolates org admins and preserves global developer bootstrap", async () => {
  const db = await setup();
  const set = (actor,rank,email,role) => db.query("select * from siu_set_role($1,$2,$3,$4)",[actor,rank,email,role]);
  try {
    await assert.rejects(set("user@test",1,"other@test","admin"),/FORBIDDEN/);
    await set("dev@test",5,"super@test","super_admin");
    await set("super@test",1,"admin@test","admin");
    await set("admin@test",1,"member@test","official_member");
    await assert.rejects(set("admin@test",1,"other@test","admin"),/FORBIDDEN/);
    await assert.rejects(set("admin@test",1,"super@test","user"),/FORBIDDEN/);
    await assert.rejects(set("super@test",1,"super@test","user"),/FORBIDDEN/);
    await assert.rejects(set("dev@test",5,"other@test","developer"),/FORBIDDEN/);
    await set("admin@test",1,"member@test","user");
  } finally { await db.close(); }
});
test("rating only for applicants after end; view merges own history without pretending to know attendance", async () => {
  const db = await setup();
  try {
    const a = await save(db, undefined, normalized({ status: "published" }));
    await apply(db,a.id);
    await assert.rejects(apply(db,a.id,"user@example.test","rate",5), /RATING_NOT_ELIGIBLE/);
    await db.query("update siu_activities set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",[a.id]);
    await assert.rejects(apply(db,a.id,"other@example.test","rate",5), /RATING_NOT_ELIGIBLE/);
    const rated = await apply(db,a.id,"user@example.test","rate",5);
    assert.equal(rated.rating,5); assert.ok(rated.rated_at);
    await assert.rejects(apply(db,a.id,"user@example.test","rate",2),/ALREADY_RATED/);
    const rows = (await db.query("select source,user_id,rating from kline_activity_history_v1")).rows;
    assert.deepEqual(rows,[{source:"social_impact_union",user_id:"user@example.test",rating:5}]);
    await db.query("update siu_activities set status='hidden' where id=$1",[a.id]);
    assert.equal((await db.query("select * from kline_activity_history_v1")).rows.length,0);
  } finally { await db.close(); }
});

function serverHarness({ user = "me@example.test", admin = false, readOnly = false, store = async () => [] } = {}) {
  const access = { email: user, authenticated: Boolean(user), displayName: "Me", role: admin ? "admin" : "user", isAdmin: admin, globalRank: 1, isReadOnly: readOnly };
  let secondary;
  const module = loader({
    "./model": model,
    "@/lib/siu/access": { getCurrentSiuAccess: async () => access },
    "./access": { getCurrentSiuAccess: async () => access, requireSiuWrite: (a) => { if (!a.authenticated) throw new model.SiuError("LOGIN_REQUIRED",401); if(a.isReadOnly) throw new model.SiuError("READ_ONLY_DEVELOPER",403); } },
    "@/auth": { auth: async () => user ? { user: { email: user } } : null },
    "@/lib/admin": { normalizeEmail: (x) => x?.trim().toLowerCase() || "", getAdminAccess: async () => ({ isSuperAdmin: false }) },
    "@/lib/supabaseServer": { supabaseRequest: store, SupabaseRequestError: class extends Error {} },
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers }) }, after: (fn) => { secondary = fn; } }
  })("src/lib/siu/server.ts");
  return { ...module, access, runSecondary: () => secondary?.() };
}
const request = (body, path = "/api/siu/activities", origin = "https://kline.test") => new Request("https://kline.test" + path, {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body)
});
test("anonymous browse query filters visibility and returns explicit public fields, not creator email", async () => {
  const h = serverHarness({ user:"", store: async (path) => {
    assert.match(decodeURIComponent(path),/status=eq.published/);
    return [{...normalized({status:"published"}), id:"id", creator_user_key:"private@test",creator_display_name:"Creator",hidden_by:"admin@test", application_count:1}];
  }});
  const result = await h.listSiuActivities(new URLSearchParams());
  assert.equal(result.activities.length,1);
  assert.equal(JSON.stringify(result).includes("private@test"),false);
  assert.equal(JSON.stringify(result).includes("admin@test"),false);
});
test("auth, read-only developer and same-origin checks prevent creation and role changes", async () => {
  for(const options of [{user:""},{readOnly:true}]) {
    let writes=0; const h=serverHarness({...options,store:async()=>{writes++;}});
    const req=request({activity:valid()});
    const response=await h.siuEndpoint(req,(access)=>h.mutateActivity(req,access,null));
    assert.ok([401,403].includes(response.status)); assert.equal(writes,0);
  }
  const h=serverHarness();
  assert.equal((await h.siuEndpoint(request({},"/api/siu/activities","https://evil.test"),async()=>({}))).status,403);
  await assert.rejects(h.mutateRole(request({email:"other@test",role:"admin"}),h.access),/FORBIDDEN/);
});
test("only creators/admins may read private applicant lists; public detail hides drafts", async () => {
  const id="00000000-0000-0000-0000-000000000001";
  const a={...normalized(),id,creator_user_key:"owner@example.test",application_count:0};
  let applicantReads=0;
  const store=async(path)=>{if(path.startsWith("siu_activity_summaries"))return[a];applicantReads++;return[];};
  const other=serverHarness({store});
  await assert.rejects(other.siuApplicants(id,other.access,new URLSearchParams()),/FORBIDDEN/);
  await assert.rejects(other.siuDetail(id,other.access),/NOT_FOUND/);
  assert.equal(applicantReads,0);
  const owner=serverHarness({user:"owner@example.test",store});
  assert.ok(await owner.siuApplicants(id,owner.access,new URLSearchParams()));
  const admin=serverHarness({admin:true,store});assert.ok(await admin.siuApplicants(id,admin.access,new URLSearchParams()));
});
test("server retires native SIU applications before any write or preference side effect", async () => {
  const id="00000000-0000-0000-0000-000000000001";
  let writes=0;
  const row={id,activity_id:id,user_key:"me@example.test",applied_at:future(-1),categories_snapshot:["outdoor"],tags_snapshot:[],title_snapshot:"Walk",rating:null,rated_at:null};
  const h=serverHarness({store:async(path,init)=>{
    if(path==="rpc/siu_apply"){const data=JSON.parse(init.body);assert.equal(data.p_user,"me@example.test");writes++;return row;}
    throw Error("Preference service offline");
  }});
  const req=request({action:"apply",user_key:"victim@test",creator_user_key:"victim@test"});
  await assert.rejects(h.mutateApplication(req,h.access,id),(error)=>error?.code==="NATIVE_APPLICATION_RETIRED"&&error?.status===410);
  await h.runSecondary(); assert.equal(writes,0);
});
test("SIU structured mapping and idempotent events reach the unchanged preference engine", async () => {
  const db=await setup();
  try{
    await db.exec(readFileSync("supabase/activity_preferences_v1.sql","utf8"));
    const a=await save(db,undefined,normalized({status:"published"}));
    const p=await apply(db,a.id);
    await db.query("insert into activity_preference_activity_map(source,activity_id,canonical_title,categories,tags) values('social_impact_union',$1,$2,$3,$4)",[a.id,a.title,a.categories,a.tags]);
    const mod=loader({"@/lib/activity-preferences/hooks":{},"@/lib/activity-preferences/events":{},"@/lib/activity-preferences/server":{},"@/lib/activity-preferences/store":{}})("src/lib/siu/preferences.ts");
    const events=mod.siuPreferenceEvents(p);assert.equal(events.length,1);assert.equal(events[0].event_type,"applied");
    for(let n=0;n<2;n++)await db.query("select record_activity_preference_event($1::jsonb)",[JSON.stringify(events[0])]);
    const rows=(await db.query("select source,categories,tags,event_type from activity_preference_events")).rows;
    assert.equal(rows.length,1);assert.deepEqual(rows[0].categories,a.categories);assert.equal(rows[0].source,"social_impact_union");
    await db.query("select recompute_activity_preferences($1,now(),'v1',180,10,4)",[p.user_key]);
    assert.equal((await db.query("select application_count from activity_preference_profile_state")).rows[0].application_count,1);
    await db.query("update siu_activities set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",[a.id]);
    const rating=await apply(db,a.id,"user@example.test","rate",5);
    for(const event of mod.siuPreferenceEvents(rating))await db.query("select record_activity_preference_event($1::jsonb)",[JSON.stringify(event)]);
    await db.query("select recompute_activity_preferences($1,now(),'v1',180,10,4)",[p.user_key]);
    const profile=(await db.query("select application_count,rating_count from activity_preference_profile_state")).rows[0];
    assert.equal(profile.application_count,1);assert.equal(profile.rating_count,1);
    assert.equal((await db.query("select count(*) n from activity_preference_events where event_type not in ('applied','rating_submitted')")).rows[0].n,0);
  }finally{await db.close();}
});

test("SIU session responses are account-bound, shared history reads use the union, and rendering stays plain text", () => {
  const ui=readFileSync("src/components/social-impact-union/SiuPlatform.tsx","utf8");
  assert.match(ui,/result.ownerEmail !== ownerEmail/);
  assert.match(ui,/controller.abort\(\)/);
  assert.match(ui,/key=\{\(data\?\.user\?\.email/);
  assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);
  assert.match(ui,/\{a.description\}/);
  assert.match(readFileSync("src/app/api/activity-history/timeline/route.ts","utf8"),/kline_activity_history_v1/);
  assert.match(readFileSync("src/app/api/activity-history/records/route.ts","utf8"),/kline_activity_history_v1/);
  assert.match(readFileSync("src/components/MyHistory.tsx","utf8"),/Activity ended/);
});
