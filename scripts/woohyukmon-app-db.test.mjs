import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20261006113501_woohyukmon_universal_app_v1.sql', import.meta.url), 'utf8');
const owner='10000000-0000-4000-8000-000000000001', member='10000000-0000-4000-8000-000000000002', outsider='10000000-0000-4000-8000-000000000003';
async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
  await db.exec(migration);
  await db.exec('set role service_role;');
  const cmd=async(actor,action,data)=>(await db.query('select public.woo_v1_command($1::uuid,$2,$3::jsonb) as result',[actor,action,JSON.stringify(data)])).rows[0].result;
  const organizationId=(await cmd(owner,'create_organization',{name:'QA organization'})).id;
  const data={organizationId,title:'QA Event',description:'',descriptionEn:'',startsAt:'2026-01-02T09:00:00Z',endsAt:'2026-01-02T10:00:00Z',location:'QA room',online:false,capacity:1,waitlist:true,approval:'automatic',applicationsOpenAt:'2025-01-01T00:00:00Z',applicationsCloseAt:'2026-01-02T09:00:00Z',visibility:'public',questions:[{id:'experience',title:'Experience',type:'text',required:true,options:[]}]};
  // Clock-independent application windows cover the current database time, not fixtures in the app UI.
  const now=Date.now(); data.startsAt=new Date(now-3600000).toISOString();data.endsAt=new Date(now+3600000).toISOString();data.applicationsCloseAt=new Date(now+1800000).toISOString();
  const eventId=(await cmd(owner,'create_event',data)).id;
  await cmd(owner,'set_status',{eventId,status:'open'});
  return {db,cmd,organizationId,eventId,data};
}
test('two simultaneous events remain open, applications separated and duplicate guarded',async()=>{
  const {db,cmd,eventId,data}=await setup();try {
    const second=(await cmd(owner,'create_event',{...data,title:'Second'})).id;
    await cmd(owner,'set_status',{eventId:second,status:'open'});
    await cmd(member,'apply',{eventId,displayName:'Member',answers:{experience:'First'}});
    await cmd(member,'apply',{eventId:second,displayName:'Member',answers:{experience:'Second'}});
    await assert.rejects(cmd(member,'apply',{eventId,displayName:'Member',answers:{experience:'Duplicate'}}),/ALREADY_APPLIED/);
    await cmd(owner,'set_status',{eventId:second,status:'closed'});
    assert.equal((await db.query('select status from public.woo_v1_events where id=$1',[eventId])).rows[0].status,'open');
    assert.equal((await db.query('select count(*)::int as n from public.woo_v1_applications')).rows[0].n,2);
  } finally {await db.close();}
});
test('event row lock serializes capacity and waitlists overflow; invalid required answer rejected',async()=>{
  const {db,cmd,eventId}=await setup();try {
    await assert.rejects(cmd(member,'apply',{eventId,displayName:'Member',answers:{}}),/ANSWER_REQUIRED/);
    const a=await cmd(member,'apply',{eventId,displayName:'Member',answers:{experience:'Yes'}});
    const b=await cmd(outsider,'apply',{eventId,displayName:'Other',answers:{experience:'Yes'}});
    assert.equal(a.status,'approved');assert.equal(b.status,'waitlist');
    await assert.rejects(cmd(owner,'review_application',{eventId,applicationId:b.id,status:'approved'}),/CAPACITY_FULL/);
  } finally {await db.close();}
});
test('ownership cannot be forged; private/member event and role delegation restricted',async()=>{
  const {db,cmd,eventId,data}=await setup();try {
    await assert.rejects(cmd(outsider,'set_status',{eventId,status:'closed'}),/FORBIDDEN/);
    await assert.rejects(cmd(outsider,'create_event',data),/FORBIDDEN/);
    await cmd(owner,'set_event_role',{eventId,memberId:member,role:'manager'});
    await assert.rejects(cmd(member,'set_event_role',{eventId,memberId:outsider,role:'manager'}),/FORBIDDEN/);
    const privateId=(await cmd(owner,'create_event',{...data,visibility:'members'})).id;
    await cmd(owner,'set_status',{eventId:privateId,status:'open'});
    await assert.rejects(cmd(outsider,'apply',{eventId:privateId,displayName:'Other',answers:{experience:'Yes'}}),/FORBIDDEN/);
  } finally {await db.close();}
});
test('applications are not attendance; verified attendance required for memory',async()=>{
  const {db,cmd,eventId}=await setup();try {
    await cmd(member,'apply',{eventId,displayName:'Member',answers:{experience:'Yes'}});
    assert.equal((await db.query('select count(*)::int as n from public.woo_v1_attendance')).rows[0].n,0);
    await cmd(owner,'set_status',{eventId,status:'closed'});
    await assert.rejects(cmd(owner,'set_status',{eventId,status:'completed'}),/EVENT_NOT_FINISHED/);
    await db.query("update public.woo_v1_events set ends_at=now()-interval '1 second', starts_at=now()-interval '2 hours', applications_close_at=now()-interval '2 seconds' where id=$1",[eventId]);
    await cmd(owner,'set_status',{eventId,status:'completed'});
    await assert.rejects(cmd(member,'save_memory',{eventId,title:'My memory',body:'',visibility:'private',photoConsent:false}),/ATTENDANCE_REQUIRED/);
    await cmd(owner,'confirm_attendance',{eventId,memberId:member});
    const memory=await cmd(member,'save_memory',{eventId,title:'My memory',body:'',visibility:'private',photoConsent:false});
    assert.equal(memory.status,'pending');
    await assert.rejects(cmd(outsider,'save_memory',{eventId,memoryId:memory.id,title:'Stolen',body:'',visibility:'public',photoConsent:true}),/ATTENDANCE_REQUIRED/);
    await assert.rejects(cmd(member,'save_memory',{eventId,title:'No consent',body:'',visibility:'public',photoConsent:false}),/CONSENT_REQUIRED/);
  } finally {await db.close();}
});
test('form with responses and stale revisions cannot silently overwrite; audit persists',async()=>{
  const {db,cmd,eventId,data}=await setup();try {
    await cmd(member,'apply',{eventId,displayName:'Member',answers:{experience:'Yes'}});
    await assert.rejects(cmd(owner,'update_event',{...data,eventId,revision:2,questions:[]}),/FORM_HAS_RESPONSES/);
    await assert.rejects(cmd(owner,'update_event',{...data,eventId,revision:1}),/REVISION_CONFLICT/);
    await cmd(owner,'update_event',{...data,eventId,revision:2,title:'Changed'});
    assert.ok((await db.query('select count(*)::int as n from public.woo_v1_audit')).rows[0].n>=4);
  } finally {await db.close();}
});
test('PKCE grant is one-use, expired/replayed/wrong-verifier grants rejected',async()=>{
  const {db}=await setup();try {
    await db.query("insert into public.woo_v1_mobile_grants values('code',$1,'challenge',now()+interval '2 minutes',null)",[member]);
    await assert.rejects(db.query("select public.woo_v1_exchange_grant('code','wrong','token')"),/INVALID_LOGIN_CODE/);
    await db.query("select public.woo_v1_exchange_grant('code','challenge','token')");
    await assert.rejects(db.query("select public.woo_v1_exchange_grant('code','challenge','token2')"),/INVALID_LOGIN_CODE/);
    await db.query("insert into public.woo_v1_mobile_grants values('old',$1,'challenge',now()-interval '1 second',null)",[member]);
    await assert.rejects(db.query("select public.woo_v1_exchange_grant('old','challenge','token3')"),/INVALID_LOGIN_CODE/);
  } finally {await db.close();}
});
test('anonymous/authenticated roles have no table or RPC privileges; RLS enabled',async()=>{
  const {db}=await setup();try {
    await db.exec('reset role;set role anon;');
    await assert.rejects(db.query('select * from public.woo_v1_applications'),/permission denied/);
    await assert.rejects(db.query('select public.woo_v1_command($1,\'create_organization\',\'{"name":"bad"}\')',[outsider]),/permission denied/);
    await db.exec('reset role;');
    const rows=(await db.query("select relrowsecurity from pg_class where relname like 'woo_v1_%' and relkind='r'")).rows;
    assert.equal(rows.length,16);assert.ok(rows.every(r=>r.relrowsecurity));
  } finally {await db.close();}
});
test('deletion request immediately revokes app sessions and rejects later commands',async()=>{
  const {db,cmd}=await setup();try {
    await db.query("insert into public.woo_v1_mobile_sessions(token_hash,member_id,expires_at) values('test-session',$1,now()+interval '1 day')",[member]);
    assert.equal((await cmd(member,'request_deletion',{})).status,'pending');
    assert.ok((await db.query("select revoked_at from public.woo_v1_mobile_sessions where token_hash='test-session'")).rows[0].revoked_at);
    await assert.rejects(cmd(member,'create_organization',{name:'After deletion'}),/DELETION_PENDING/);
  } finally {await db.close();}
});
