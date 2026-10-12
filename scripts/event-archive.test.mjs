import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { archiveHarness } from "./event-archive-harness.mjs";

test("Event Archive: actual local PostgreSQL + filesystem round-trip, not remote Supabase certification", async t => {
  const h = await archiveHarness(), { api, db, control } = h;
  const manifest = (texts, files = [], clubKey = "ecc") => ({texts,files,clubKey,idempotencyKey:randomUUID(),sourceKind:"paste",aiConsent:false});
  const save = async (text, club="ecc") => {const p=await api.prepareImport(h.access(),manifest([text],[],club));const r=await api.finalizeImport(h.access(),p.batch_id);assert.equal(r.status,"saved");return r.results[0].archiveId;};
  const descriptor = (name,bytes,mimeType) => ({name,size:bytes.length,mimeType,sha256:api.sha256(bytes)});
  const png = createCanvas(8,8).toBuffer("image/png");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  let originalId, originalText;
  try {
    await t.test("emoji 20+, mixed languages, CRLF, repeated whitespace, typo and combining Unicode stay exact", async () => {
      originalText = "  🏹🎯🎉🎊🎈🧘🌏🌍🌎🍵📚📝🖼️🎵📅⏰✅⚠️💬🤝🚶🔔  ECC × 한활\r\n\r\n띄어  쓰기\t Englis typo! e\u0301 / é / \u1100\u1161\nhttps://example.test/a?x=1&y=2\n  ";
      originalId = await save(originalText);
      const r = await api.loadArchiveItem(h.access(), originalId);
      assert.equal(r.original_text, originalText);assert.equal(r.original_text_sha256,api.sha256(originalText));assert.equal(r.visibility,"private");assert.equal(r.review_status,"pending");
    });
    await t.test("NULL/lone surrogate rejected instead of lossily repaired", () => {
      assert.throws(()=>api.originalText("a\0b"),/UNSUPPORTED_TEXT_ENCODING/);assert.throws(()=>api.originalText("\uD800"),/UNSUPPORTED_TEXT_ENCODING/);
      assert.equal(api.originalText("  \n"),"  \n");
    });
    await t.test("DB trigger prevents original changes even with service role", async () => {
      await assert.rejects(db.query("update event_archive_items set original_text='corrected' where id=$1",[originalId]),/ARCHIVE_ORIGINAL_IMMUTABLE/);
      await assert.rejects(db.query("update event_archive_items set club_key='hanhwal' where id=$1",[originalId]),/ARCHIVE_ORIGINAL_IMMUTABLE/);
    });
    await t.test("idempotent retry returns same record and prevents different payload reuse", async () => {
      const m=manifest([originalText]);const p=await api.prepareImport(h.access(),m);const a=await api.finalizeImport(h.access(),p.batch_id);const replay=await api.finalizeImport(h.access(),p.batch_id);
      assert.equal(a.results[0].archiveId,originalId);assert.equal(replay.results[0].archiveId,originalId);assert.equal(a.archive_items[0].duplicate,true);
      await assert.rejects(api.prepareImport(h.access(),{...m,texts:["different"]}),/IDEMPOTENCY_CONFLICT/);
    });
    await t.test("PNG and PDF bytes are unchanged after disk upload, DB save and signed download", async () => {
      const files=[descriptor("poster.png",png,"image/png"),descriptor("notice.pdf",pdf,"application/pdf")];
      const p=await api.prepareImport(h.access(),manifest([],files));await h.upload(p,[png,pdf]);const r=await api.finalizeImport(h.access(),p.batch_id);assert.equal(r.status,"saved");
      for(let i=0;i<r.results.length;i++) {const item=await api.loadArchiveItem(h.access(),r.results[i].archiveId);const a=item.assets[0];
        assert.equal(a.original_filename,files[i].name);assert.equal(a.sha256,files[i].sha256);assert.deepEqual(Buffer.from(await api.originalBytes(a.original_storage_path)),i?pdf:png);
        const signed=await api.archiveDownload(h.access(),item.id,a.id);assert.equal(signed.expiresIn,60);
        assert.deepEqual(Buffer.from(await (await h.fetch(signed.url)).arrayBuffer()),i?pdf:png);
        await assert.rejects(db.query("update event_archive_assets set original_filename='new.png' where id=$1",[a.id]),/ARCHIVE_ASSET_IMMUTABLE/);
      }
    });
    await t.test("identical binary with another filename reuses blob but preserves distinct record and import relation", async () => {
      const p=await api.prepareImport(h.access(),manifest([],[descriptor("another-name.png",png,"image/png")]));
      await h.upload(p,[png]);const r=await api.finalizeImport(h.access(),p.batch_id);assert.equal(r.status,"saved");
      const item=await api.loadArchiveItem(h.access(),r.results[0].archiveId);
      const rows=(await db.query("select * from event_archive_assets where sha256=$1",[api.sha256(png)])).rows;
      assert.equal(rows.length,2);assert.equal(new Set(rows.map(a=>a.original_storage_path)).size,1);
      assert.equal(item.assets[0].original_filename,"another-name.png");assert.equal(h.objects.size,2);
      assert.equal((await api.finalizeImport(h.access(),p.batch_id)).status,"saved");
    });
    await t.test("text file preserves BOM/CRLF both as bytes and searchable original text", async () => {
      const text="\uFEFF공지 e\u0301\r\n  Typo!  \n",bytes=Buffer.from(text),p=await api.prepareImport(h.access(),manifest([],[descriptor("raw.txt",bytes,"text/plain")]));
      await h.upload(p,[bytes]);const r=await api.finalizeImport(h.access(),p.batch_id);assert.equal(r.status,"saved",JSON.stringify(r));const item=await api.loadArchiveItem(h.access(),r.results[0].archiveId);assert.equal(item.original_text,text);assert.equal(item.original_text_sha256,api.sha256(text));
    });
    await t.test("source-provided collection groups originals without widening scope or replacing source bytes", async () => {
      const collection = { id: "one-private-festival", title: "Private festival", eventDate: "2026-10-17", organizerNames: ["Festival organizers"] };
      const input = { ...manifest(["Collection notice"], [], "unclassified"), collection, aiConsent: true };
      const prepared = await api.prepareImport(h.access(), input), saved = await api.finalizeImport(h.access(), prepared.batch_id);
      const id = saved.results[0].archiveId, loaded = await api.loadArchiveItem(h.access(), id);
      assert.deepEqual(loaded.collection, collection); assert.equal(loaded.original_text, "Collection notice");
      const previous = control.aiLabels;
      try {
        control.aiLabels = { ...previous, suggestedClub: "other", eventDate: "2026-10-17", organizerName: "Festival organizers", eventName: "Private festival" };
        const classified = await api.classifyArchive(h.access(), id);
        assert.equal(classified.item.event_date.slice(0, 10), "2026-10-17"); assert.equal(classified.item.club_key, "unclassified");
        assert.equal(classified.item.derivedLabels.organizerName, "Festival organizers");
      } finally { control.aiLabels = previous; }
      const list = await api.listArchive(h.access(), new URLSearchParams({ batch: prepared.batch_id }));
      assert.equal(list.items.length, 1); assert.deepEqual(list.items[0].collection, collection);
      assert.equal((await api.listArchive({email:"member@example.test",clubs:[],superAdmin:false,readOnly:true},new URLSearchParams({batch:prepared.batch_id}))).items.length, 0);
      await assert.rejects(api.listArchive(h.access(), new URLSearchParams({batch:"invalid"})), /INVALID_ARCHIVE_ID/);
      assert.throws(() => api.parseManifest({...input, collection:{...collection,eventDate:"2026-02-30"}}), /INVALID_COLLECTION/);
      assert.throws(() => api.parseManifest({...input, collection:{...collection,organizerNames:"injected"}}), /INVALID_COLLECTION/);
      const replay = await api.prepareImport(h.access(), input); assert.equal(replay.batch_id,prepared.batch_id);
      await assert.rejects(api.prepareImport(h.access(), {...input,collection:{...collection,title:"Changed provenance"}}), /IDEMPOTENCY_CONFLICT/);
    });
    await t.test("mixed batch keeps original input order and resumes after interruption", async () => {
      const m=manifest(["첫 번째", "second"],[descriptor("retry.png",png,"image/png")]),p=await api.prepareImport(h.access(),m);
      const partial=await api.finalizeImport(h.access(),p.batch_id);assert.equal(partial.status,"partial");assert.equal(partial.results[2].error,"UPLOAD_NOT_RECEIVED");
      assert.equal((await db.query("select count(*) from event_archive_links where target_id=$1",[p.batch_id])).rows[0].count,2);
      await h.upload(p,[png]);control.disconnect=true;const interrupted=await api.finalizeImport(h.access(),p.batch_id);assert.equal(interrupted.status,"partial");control.disconnect=false;
      const completed=await api.finalizeImport(h.access(),p.batch_id);assert.equal(completed.status,"saved");assert.deepEqual(completed.results.map(r=>r.index),[0,1,2]);
      assert.equal(completed.results[0].archiveId,partial.results[0].archiveId);
    });
    await t.test("hash mismatch / MIME spoofing / active PDF / oversized file cannot become saved", async () => {
      await assert.rejects(api.verifyOriginalFile(descriptor("x.png",png,"image/png"),Buffer.from("bad")),/ORIGINAL_HASH_MISMATCH/);
      await assert.rejects(api.verifyOriginalFile(descriptor("x.png",pdf,"image/png"),pdf),/FILE_SIGNATURE_MISMATCH/);
      const active=Buffer.from("%PDF-1.4 /JavaScript\n%%EOF");await assert.rejects(api.verifyOriginalFile(descriptor("x.pdf",active,"application/pdf"),active),/ACTIVE_DOCUMENT_NOT_ALLOWED/);
      assert.throws(()=>api.parseManifest(manifest([],[{...descriptor("x.png",png,"image/png"),size:26214401}])),/FILE_TOO_LARGE/);
      const p=await api.prepareImport(h.access(),manifest([],[descriptor("mismatch.png",png,"image/png")]));await h.upload(p,[pdf]);const r=await api.finalizeImport(h.access(),p.batch_id);assert.equal(r.status,"partial");assert.equal(r.archive_items.length,0);
      assert.equal((await api.cleanImportOrphans(h.access(),p.batch_id)).removedTemporaryObjects,1);
    });
    await t.test("concurrent job lease rejects double-finalize and expired lease is recoverable", async () => {
      const p=await api.prepareImport(h.access(),manifest(["lease recovery"]));await db.query("select event_archive_claim($1,$2,$3)",[p.batch_id,control.email,randomUUID()]);
      await assert.rejects(api.finalizeImport(h.access(),p.batch_id),/IMPORT_BUSY/);
      await assert.rejects(api.cleanImportOrphans(h.access(),p.batch_id),/IMPORT_BUSY/);
      await assert.rejects(db.query("select event_archive_commit($1,$2,$3)",[JSON.stringify({batch_id:p.batch_id,created_by:control.email}),null,randomUUID()]),/IMPORT_BUSY/);
      await db.query("update event_archive_import_jobs set lease_until=now()-interval '1 minute' where id=$1",[p.batch_id]);assert.equal((await api.finalizeImport(h.access(),p.batch_id)).status,"saved");
    });
    await t.test("AI consent is separate; AI failure cannot mutate/remove original", async () => {
      await assert.rejects(api.classifyArchive(h.access(),originalId),/AI_ANALYSIS_CONSENT_REQUIRED/);
      await api.reviewArchive(h.access(),originalId,{confirmed:true,visibility:"private",checklist:{privacy:true,copyright:true,source:true},aiConsent:true,aiSearchAllowed:false});
      const configured=process.env.EVENT_AI_ENABLED;
      try {
        process.env.EVENT_AI_ENABLED="false";
        for(let i=0;i<4;i++)await assert.rejects(api.classifyArchive(h.access(),originalId),/ARCHIVE_AI_UNAVAILABLE/);
        assert.equal((await db.query("select count(*) from event_archive_labels where archive_item_id=$1",[originalId])).rows[0].count,0);
      } finally { process.env.EVENT_AI_ENABLED=configured; }
      control.aiFail=true;await assert.rejects(api.classifyArchive(h.access(),originalId),/ARCHIVE_AI_UNAVAILABLE/);control.aiFail=false;
      const item=await api.loadArchiveItem(h.access(),originalId);assert.equal(item.original_text,originalText);assert.equal(item.classification_status,"failed");
    });
    await t.test("structured labels preserve original and suggested club never grants access", async () => {
      control.aiLabels={...control.aiLabels,suggestedClub:"hanhwal",eventDate:"2099-01-01"};await api.classifyArchive(h.access(),originalId);
      const item=await api.loadArchiveItem(h.access(),originalId);assert.equal(item.club_key,"ecc");assert.equal(item.event_date,null);assert.equal(item.original_text,originalText);assert.equal(item.visibility,"private");assert.equal(item.derivedLabels.suggestedClub,"hanhwal");
    });
    await t.test("label validation handles hosts, unknown dates and invalid schema", () => {
      for(const suggestedClub of ["ecc","hanhwal","social_impact_union","unclassified"]) assert.equal(api.parseLabels({...control.aiLabels,suggestedClub,eventDate:null}).suggestedClub,suggestedClub);
      assert.equal(api.parseLabels({...control.aiLabels,eventDate:"2026-11-01"},"2026-11-01").eventDate,"2026-11-01");
      assert.throws(()=>api.parseLabels({...control.aiLabels,confidence:NaN}),/INVALID_LABELS/);
    });
    await t.test("ECC / HANHWAL / SIU / ambiguous hosts classify as derived suggestions, never change owning scope", async () => {
      const prior=control.aiLabels;
      for(const host of ["ecc","hanhwal","social_impact_union","unclassified"]) {
        const p=await api.prepareImport(h.access(),{...manifest([`historical source ${host}`],[],host),aiConsent:true});
        const r=await api.finalizeImport(h.access(),p.batch_id),id=r.results[0].archiveId;
        control.aiLabels={...prior,suggestedClub:host,eventDate:null,confidence:host==="unclassified"?0.2:0.9};
        await api.classifyArchive(h.access(),id);
        const item=await api.loadArchiveItem(h.access(),id);
        assert.equal(item.club_key,host);assert.equal(item.derivedLabels.suggestedClub,host);
        assert.equal(item.classification_status,"review_required");assert.equal(item.visibility,"private");
      }
      control.aiLabels=prior;
    });
    await t.test("cross-club reads, writes, downloads, own-job identity and read-only writes denied", async () => {
      const han=await save("HANHWAL private poster", "hanhwal");const ecc={email:control.email,clubs:["ecc"],superAdmin:false,readOnly:false};
      await assert.rejects(api.loadArchiveItem(ecc,han),/ARCHIVE_NOT_FOUND/);
      await assert.rejects(api.prepareImport(ecc,manifest(["x"],[],"hanhwal")),/CLUB_ADMIN_REQUIRED/);
      await assert.rejects(api.prepareImport({...ecc,readOnly:true},manifest(["x"])),/READ_ONLY_ACCOUNT/);
      const p=await api.prepareImport(h.access(),manifest(["own only"]));await assert.rejects(api.finalizeImport({...ecc,email:"other@example.test"},p.batch_id),/IMPORT_NOT_FOUND/);
    });
    await t.test("refresh recovery lists only own unfinished batches in currently authorized clubs", async () => {
      const ecc={email:control.email,clubs:["ecc"],superAdmin:false,readOnly:false};
      const file=descriptor("refresh.png",png,"image/png");
      const p=await api.prepareImport(ecc,manifest(["refresh original"],[file]));
      const partial=await api.finalizeImport(ecc,p.batch_id);assert.equal(partial.status,"partial");
      const pending=await api.pendingImports(ecc),job=pending.jobs.find(j=>j.batchId===p.batch_id);
      assert.equal(job.saved,1);assert.equal(job.total,2);assert.equal(job.clubKey,"ecc");
      assert.ok(pending.jobs.every(j=>j.clubKey==="ecc"));
      assert.equal(JSON.stringify(pending).includes("refresh original"),false);
      assert.equal((await api.pendingImports({...ecc,email:"other@example.test"})).jobs.length,0);
      await assert.rejects(api.pendingImports({...ecc,readOnly:true}),/ARCHIVE_WRITE_DENIED/);
      await assert.rejects(api.pendingImports({...ecc,clubs:[]}),/ARCHIVE_WRITE_DENIED/);
      const state=await api.importStatus(ecc,p.batch_id);assert.deepEqual(state.files,[file]);
      await h.upload(state,[png]);const finished=await api.finalizeImport(ecc,p.batch_id);
      assert.equal(finished.status,"saved");assert.equal(finished.results[0].archiveId,partial.results[0].archiveId);
      assert.equal((await api.pendingImports(ecc)).jobs.some(j=>j.batchId===p.batch_id),false);
    });
    await t.test("no publication without explicit privacy/copyright/source review, including direct DB constraints", async () => {
      await assert.rejects(api.reviewArchive(h.access(),originalId,{confirmed:true,visibility:"public",checklist:{privacy:true}}),/REVIEW_CHECKLIST_REQUIRED/);
      await assert.rejects(db.query("update event_archive_items set visibility='public',review_status='approved',reviewed_by='qa',review_checklist=null where id=$1",[originalId]),/check constraint/);
      const unknown=await save("unknown source", "unclassified");await assert.rejects(api.reviewArchive(h.access(),unknown,{confirmed:true,visibility:"public",checklist:{privacy:true,copyright:true,source:true}}),/UNKNOWN_SOURCE_CANNOT_PUBLISH/);
    });
    await t.test("normal members see only approved public records and search cannot widen scope", async () => {
      await api.reviewArchive(h.access(),originalId,{confirmed:true,visibility:"public",checklist:{privacy:true,copyright:true,source:true},aiConsent:true,aiSearchAllowed:true});
      const member={email:"member@example.test",clubs:[],superAdmin:false,readOnly:false};
      const result=await api.listArchive(member,new URLSearchParams({q:"Englis"}));assert.equal(result.items.length,1);assert.equal(result.items[0].id,originalId);assert.equal(result.items[0].created_by,"");
      assert.equal((await api.listArchive(member,new URLSearchParams({club:"hanhwal"}))).items.length,0);
      assert.equal((await api.listArchive(member,new URLSearchParams({q:'",visibility.eq.private)'}))).items.length,0);
      await assert.rejects(api.saveLabels(member,originalId,control.aiLabels),/CLUB_ADMIN_REQUIRED/);
    });
    await t.test("tag and date filters are exact and do not skip access control", async () => {
      await api.saveLabels(h.access(),originalId,{...control.aiLabels,eventDate:"2026-11-01",tags:["Exact tag"]});
      assert.equal((await api.listArchive(h.access(),new URLSearchParams({tag:"Exact tag",from:"2026-11-01",to:"2026-11-01"}))).items.length,1);
      assert.equal((await api.listArchive(h.access(),new URLSearchParams({tag:"Exact"}))).items.length,0);
    });
    await t.test("new version gets separate immutable record and explicit parent link", async () => {
      const result=await api.newArchiveVersion(h.access(),originalId,"new proposal, original retained",randomUUID());const id=result.results[0].archiveId;assert.notEqual(id,originalId);
      assert.equal((await api.loadArchiveItem(h.access(),originalId)).original_text,originalText);assert.equal((await api.loadArchiveItem(h.access(),id)).versions[0].original_item_id,originalId);
    });
    await t.test("historical references require same scope, review and AI-search consent; links removed", async () => {
      await assert.rejects(api.historicalReferences(h.access(),[originalId],"ecc"),/REFERENCE_NOT_APPROVED_FOR_AI/);
      await api.reviewArchive(h.access(),originalId,{confirmed:true,visibility:"private",checklist:{privacy:true,copyright:true,source:true},aiConsent:true,aiSearchAllowed:true});
      const refs=await api.historicalReferences(h.access(),[originalId],"ecc");assert.equal(refs[0].archiveId,originalId);assert.equal(refs[0].historicalOnly,true);assert.ok(!refs[0].text.includes("https://"));
      await assert.rejects(api.historicalReferences(h.access(),[originalId],"hanhwal"),/REFERENCE_NOT_APPROVED_FOR_AI/);
    });
    await t.test("RLS/grants block every direct browser table access and private bucket policies are restrictive", async () => {
      for(const role of ["anon","authenticated"]) {await db.exec(`set role ${role}`);for(const table of ["items","assets","labels","import_jobs","links","versions"]) await assert.rejects(db.query(`select * from event_archive_${table}`),/permission denied/);await db.exec("set role service_role");}
      const policies=await db.query("select permissive from pg_policies where policyname like 'event_archive_no_direct_%'");assert.equal(policies.rows.length,4);assert.ok(policies.rows.every(r=>r.permissive==="RESTRICTIVE"));
    });
    await t.test("API auth/CSRF and short-scoped connector recheck roles; no hidden ChatGPT collection", async () => {
      const req=(body,headers={})=>new Request("https://kline.test/api/event-archive/ingest",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
      assert.equal((await api.ingestPOST(req(manifest(["csrf"])))).status,403);
      const token=api.archiveConnectorToken({...h.access(),clubs:["ecc"],superAdmin:false},"ecc");
      assert.equal((await api.ingestPOST(req(manifest(["tamper"]),{authorization:`Bearer ${token.slice(0,-5)}wrong` }))).status,401);
      assert.equal((await api.ingestPOST(req(manifest(["connector explicit source"]),{authorization:`Bearer ${token}`}))).status,200);
      assert.equal((await api.ingestPOST(req(manifest(["cross"],[],"hanhwal"),{authorization:`Bearer ${token}`}))).status,403);
      control.clubs=["hanhwal"];assert.equal((await api.ingestPOST(req(manifest(["revoked"]),{authorization:`Bearer ${token}`}))).status,403);
      control.email="";assert.equal((await api.archiveGET(new Request("https://kline.test/api/event-archive"))).status,401);
      control.email="qa-admin@example.test";control.clubs=["ecc","hanhwal","social_impact_union","unclassified"];
    });
    await t.test("developer-only release denies members and club admins at every archive entry point", async () => {
      const before = control.clubs;
      try {
        for (const clubs of [[],["ecc"],["hanhwal"],["social_impact_union"]]) {
          control.clubs = clubs;
          const response = await api.archiveGET(new Request("https://kline.test/api/event-archive"));
          assert.equal(response.status,403); assert.equal((await response.json()).error,"DEVELOPER_REQUIRED");
          await assert.rejects(api.getArchiveAccess(),/DEVELOPER_REQUIRED/);
        }
        control.clubs = before;
        assert.equal((await api.archiveGET(new Request("https://kline.test/api/event-archive"))).status,200);
        control.readOnly = true;
        const access = await api.getArchiveAccess(); assert.equal(access.readOnly,true);
        await assert.rejects(api.prepareImport(access,manifest(["read only"])),/READ_ONLY_ACCOUNT/);
        const home = await readFile(new URL("../src/components/HomeTrackSections.tsx",import.meta.url),"utf8");
        const page = await readFile(new URL("../src/app/page.tsx",import.meta.url),"utf8");
        const hub = await readFile(new URL("../src/app/event-studio/page.tsx",import.meta.url),"utf8");
        assert.match(home,/showEventStudio = false/); assert.match(home,/card\.accent !== "studio" \|\| showEventStudio/);
        assert.match(page,/showEventStudio=\{isDeveloperEmail\(session\?\.user\?\.email\)\}/);
        assert.match(hub,/if \(!isDeveloperEmail\(session\?\.user\?\.email\)\) notFound\(\)/);
      } finally { control.clubs = before; control.readOnly = false; }
    });
    await t.test("test settings cannot point to production and archive store cannot touch legacy tables", async () => {
      const old=process.env.EVENT_ARCHIVE_TEST_SUPABASE_URL;process.env.EVENT_ARCHIVE_TEST_SUPABASE_URL="https://okcabiimxuhhhokqajjg.supabase.co";assert.throws(()=>api.archiveConfig(),/ISOLATED_ARCHIVE_DATABASE_REQUIRED/);process.env.EVENT_ARCHIVE_TEST_SUPABASE_URL=old;
      await assert.rejects(api.archiveRequest("ecc_roles",{method:"DELETE"}),/ARCHIVE_TABLE_NOT_ALLOWED/);
    });
    await t.test("migration has no destructive legacy-table operations and original files are not transformed", async () => {
      const sql=await readFile(new URL("../supabase/migrations/20261011073509_event_archive_v2.sql",import.meta.url),"utf8");assert.ok(!/drop\s+table|truncate\s|delete\s+from|update\s+public\.(?:ecc|hanhwal|kline_forms)/i.test(sql));
      assert.ok(h.requests.every(r=>!r.url.includes("/render/image")));
    });
  } finally {await h.close();}
});
