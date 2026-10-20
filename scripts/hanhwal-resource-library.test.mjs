import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { resourceHarness, loadResourceModule, uuid, row } from "./lib/hanhwal-resource-harness.mjs";

test("Hanhwal role matrix protects review/private/staff data and short-lived file signing",async()=>{
  const {state,call}=resourceHarness();
  state.rows=[row(),{...row(),id:"22222222-2222-4222-8222-222222222222",status:"published",visibility:"members"},{...row(),id:"33333333-3333-4333-8333-333333333333",status:"published",visibility:"staff"},{...row(),id:"44444444-4444-4444-8444-444444444444",status:"published",published_at:new Date().toISOString()}];
  let r=await call();assert.equal(r.status,200);assert.equal((await r.json()).resources.length,1);
  for(const item of state.rows.slice(0,3))assert.equal((await call("GET",[item.id,"file"])).status,404);
  assert.equal(state.signed.length,0);
  assert.equal((await call("POST",[],{title:"Forged"})).status,403);
  state.access={email:"member@test.invalid",isOfficialMember:true,isAdmin:false};
  r=await call();const resources=(await r.json()).resources;
  assert.equal(resources.length,3);assert.equal(resources.some(r=>r.visibility==="staff"),false);
  assert.equal(JSON.stringify(resources).includes("uploader_email"),false);
  assert.equal((await call("GET",[uuid,"file"])).status,302);
  assert.equal((await call("POST",[uuid,"approve"],{revision:2})).status,403);
  assert.equal((await call("PATCH",[uuid],{visibility:"staff"})).status,403);
  assert.equal((await call("DELETE",[uuid])).status,403);
  state.access.email="other@test.invalid";assert.equal((await call("GET",[uuid])).status,404);
  state.access={email:"admin@test.invalid",isOfficialMember:true,isAdmin:true};
  assert.equal((await (await call()).json()).resources.length,4);
  assert.equal((await call("GET",[state.rows[2].id,"file"])).status,302);
  state.readOnly=true;
  assert.equal((await call("POST",[],{title:"No"})).status,403);
  assert.equal((await call("DELETE",[uuid])).status,403);
});
test("verified uploads await staff approval; MIME, size, signature, origin and stale revisions fail closed",async()=>{
  const {state,call}=resourceHarness();
  state.access={email:"member@test.invalid",isOfficialMember:true,isAdmin:false};
  const input={title:"Archery",category:"archery",fileName:"training.pdf",sizeBytes:100,mimeType:"application/pdf"};
  for(const bad of [{...input,sizeBytes:52428801},{...input,fileName:"../file.pdf"},{...input,fileName:"evil.exe"},{...input,mimeType:"text/html"},{...input,category:"mt"}])assert.equal((await call("POST",[],bad)).status,400);
  assert.equal((await call("POST",[],input,"https://evil.invalid")).status,403);
  const ticket=await (await call("POST",[],{...input,status:"published",visibility:"staff",uploader_email:"admin@test.invalid"})).json();
  const saved=state.rows[0];assert.equal(saved.status,"uploading");assert.equal(saved.visibility,"public");assert.equal(saved.uploader_email,state.access.email);
  assert.equal((await (await call()).json()).resources.length,0);
  state.stored.sizeBytes=99;assert.equal((await call("POST",[ticket.id,"publish"])).status,400);
  state.stored.sizeBytes=100;state.header=false;assert.equal((await call("POST",[ticket.id,"publish"])).status,400);
  state.header=true;assert.equal((await call("POST",[ticket.id,"publish"])).status,200);
  assert.equal(saved.status,"pending");assert.equal(saved.revision,2);
  assert.equal((await call("POST",[ticket.id,"publish"])).status,404);
  state.access={email:"admin@test.invalid",isOfficialMember:true,isAdmin:true};
  assert.equal((await call("PATCH",[ticket.id],{title:"Edited",description:"Original preserved",category:"events",visibility:"members",revision:1})).status,409);
  assert.equal((await call("PATCH",[ticket.id],{title:"Edited",description:"Original preserved",category:"events",visibility:"members",revision:2})).status,200);
  assert.equal((await call("POST",[ticket.id,"approve"],{revision:3})).status,200);assert.equal(saved.status,"published");assert.equal(saved.visibility,"members");
  state.access={email:"",isOfficialMember:false,isAdmin:false};assert.equal((await call("GET",[ticket.id,"file"])).status,404);
  state.access={email:"admin@test.invalid",isOfficialMember:true,isAdmin:true};
  assert.equal((await call("DELETE",[ticket.id])).status,200);assert.equal(saved.status,"deleted");assert.equal(state.deleted.length,1);
  assert.equal((await call("GET",[ticket.id,"file"])).status,404);
  assert.equal((await call("PATCH",["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],{})).status,404);
});
test("dedicated migration is repeatable, preserves ECC rows, enables RLS and blocks browser DB privileges",async()=>{
  const db=new PGlite();
  try{
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table public.ecc_resource_files(id integer primary key,title text); insert into public.ecc_resource_files select n,'Existing ECC' from generate_series(1,13) n;");
    const sql=readFileSync("supabase/migrations/20261020054933_hanhwal_resource_library.sql","utf8");
    await db.exec(sql);await db.exec(sql);
    assert.equal((await db.query("select count(*)::int n from ecc_resource_files")).rows[0].n,13);
    assert.equal((await db.query("select public from storage.buckets where id='hanhwal-resource-library'")).rows[0].public,false);
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='hanhwal_resource_files'")).rows[0].relrowsecurity,true);
    for(const role of ["anon","authenticated"]){
      await db.exec("set role "+role);
      await assert.rejects(db.query("select * from hanhwal_resource_files"),/permission denied/);
      await assert.rejects(db.exec("delete from hanhwal_resource_files"),/permission denied/);
      await db.exec("reset role");
    }
  }finally{await db.close();}
});
test("shared validators and categories stay club-specific; preview support is honest",()=>{
  const model=loadResourceModule("src/lib/clubResources/model.ts");
  const signature=loadResourceModule("src/lib/clubResources/signature.ts");
  assert.equal(model.isResourceCategory("mt","hanhwal"),false);assert.equal(model.isResourceCategory("archery","ecc"),false);
  assert.equal(model.resourceCategories.length,5);assert.equal(model.hanhwalResourceCategories.length,5);
  for(const [ext,magic] of [["pdf","255044462d312e37"],["pptx","504b0304"],["hwp","d0cf11e0a1b11ae1"],["png","89504e470d0a1a0a"]]){
    assert.equal(signature.validResourceHeader(Buffer.from(magic,"hex"),ext),true);
    assert.equal(signature.validResourceHeader(Buffer.from("not a file"),ext),false);
  }
  assert.equal(model.canPreviewResource("application/x-hwp"),false);
  assert.equal(model.canPreviewResource("application/vnd.openxmlformats-officedocument.presentationml.presentation"),false);
});
test("live verification never copies existing private club files",()=>{
  const source=readFileSync("scripts/hanhwal-resource-live.mjs","utf8");
  assert.doesNotMatch(source,/ecc_resource_files|ecc-resource-library|hanhwal_roles|member_registrations/);
  assert.match(source,/hanhwal-public-sample\.pptx/);
});
test("restrictive storage guards block Hanhwal even beside broad policies, without changing other buckets",async()=>{
  const db=new PGlite();
  try{
    await db.exec("create role anon; create role authenticated; create schema storage; grant usage on schema storage to anon,authenticated; create table storage.objects(id integer primary key,bucket_id text); alter table storage.objects enable row level security; grant all on storage.objects to anon,authenticated; create policy fixture_broad_access on storage.objects for all to anon,authenticated using(true) with check(true); insert into storage.objects values(1,'hanhwal-resource-library'),(2,'ecc-resource-library');");
    const sql=readFileSync("supabase/migrations/20261020061129_hanhwal_resource_storage_guard.sql","utf8");
    await db.exec(sql);await db.exec(sql);
    for(const role of ["anon","authenticated"]){
      await db.exec("set role "+role);
      assert.deepEqual((await db.query("select id from storage.objects")).rows,[{id:2}]);
      await assert.rejects(db.exec("insert into storage.objects values(3,'hanhwal-resource-library')"),/row-level security/);
      await db.exec("delete from storage.objects where id=1; update storage.objects set bucket_id='ecc-resource-library' where id=1;");
      await db.exec("reset role");
      assert.equal((await db.query("select bucket_id from storage.objects where id=1")).rows[0].bucket_id,"hanhwal-resource-library");
    }
  }finally{await db.close();}
});
