import assert from "node:assert/strict";
import {test} from "node:test";
import {eventHarness,fixturePlan,fixtureMessage} from "./event-studio-harness.mjs";

test("repeat consent preserves only a valid same-owner refresh token without renewing its timestamp",async()=>{
  const h=await eventHarness();
  try {
    const owner=h.control.email;
    const connect=()=>h.api.withPersonalGoogleConnection(owner,()=>h.api.connectGoogleOperationsAccount("qa-consent-code",owner));
    h.control.oauthNoRefresh=true;
    await assert.rejects(connect(),/GOOGLE_OFFLINE_ACCESS_REQUIRED/);
    const rows=()=>h.store.db.query("select * from kline_forms_test_google_oauth_connections where id <> 'operations'").then(result=>result.rows);
    assert.deepEqual(await rows(),[]);
    h.control.oauthNoRefresh=false;
    await connect();
    const saved=await rows();
    h.control.oauthNoRefresh=true;
    assert.equal(await connect(),owner);
    assert.deepEqual(await rows(),saved);
    h.control.oauthEmail="other@example.test";
    await assert.rejects(connect(),/GOOGLE_ACCOUNT_OWNER_MISMATCH/);
    h.control.oauthEmail=owner;
    h.control.oauthScopes="openid email";
    await assert.rejects(connect(),/GOOGLE_REQUIRED_SCOPES_NOT_GRANTED/);
    delete h.control.oauthScopes;
    h.control.invalidRefreshTokens=new Set(["qa-only-personal-refresh"]);
    await assert.rejects(connect(),/GOOGLE_RECONNECT_REQUIRED/);
    assert.deepEqual(await rows(),saved);
    h.control.invalidRefreshTokens.clear();
    h.control.oauthNoRefresh=false;
    await connect();
    assert.equal((await rows()).length,1);
    assert.equal(h.control.externalCreates,0);
  } finally {await h.close();}
});

test("ordinary users create and read their own form despite an expired operations connection",async()=>{
  const h=await eventHarness();
  try {
    h.control.clubs=[];h.control.currentPlan=fixturePlan("personal");
    const owner=h.control.email;
    await h.api.withPersonalGoogleConnection(owner,()=>h.api.connectGoogleOperationsAccount("qa-consent-code",owner));
    h.control.invalidRefreshTokens=new Set(["qa-only-refresh"]);
    assert.equal((await h.api.getGoogleConnectionStatus()).health,"reconnect_required");
    const access=await h.api.getStudioAccess();
    assert.deepEqual(access.manageableClubs,["personal"]);
    assert.deepEqual(await h.api.studioOperation(access,{action:"connection"}),{connected:true,health:"healthy"});
    await assert.rejects(h.api.studioOperation(access,{action:"connection",clubKey:"ecc"}),/CLUB_ADMIN_REQUIRED/);
    const before=(await h.store.db.query("select * from kline_forms_test_google_oauth_connections where id='operations'")).rows;
    const draft=await h.api.studioOperation(access,{action:"plan",message:fixtureMessage});
    const created=await h.api.studioOperation(access,{action:"approve",jobId:draft.job.id,token:draft.token,confirmed:true});
    assert.equal(created.job.state,"notice_saved");assert.equal(created.form.club_key,"personal");
    assert.equal((await h.api.studioOperation(access,{action:"responses",jobId:draft.job.id})).total,0);
    assert.deepEqual((await h.store.db.query("select * from kline_forms_test_google_oauth_connections where id='operations'")).rows,before);
    h.control.email="other@example.test";
    await assert.rejects(h.api.studioOperation(await h.api.getStudioAccess(),{action:"responses",jobId:draft.job.id}),/JOB_NOT_FOUND/);
    h.control.oauthUnavailable=true;
    const unavailable=await h.api.withPersonalGoogleConnection(owner,h.api.getGoogleConnectionStatus);
    assert.equal(unavailable.connected,false);assert.equal(unavailable.health,"unavailable");
  } finally {await h.close();}
});
