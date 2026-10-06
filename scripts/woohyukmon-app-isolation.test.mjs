import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';

test('private photo bucket is additive, remains private and rejects namespace collision', async () => {
  const db = new PGlite();
  try {
    await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);insert into storage.buckets values('existing','existing',true,1024,array['image/jpeg']);");
    const sql = await readFile(new URL('../supabase/migrations/20261006114550_woohyukmon_private_media_v1.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const rows = (await db.query('select * from storage.buckets order by id')).rows;
    assert.equal(rows.length, 2); assert.equal(rows[0].public, true); assert.equal(rows[0].file_size_limit, 1024);
    assert.equal(rows[1].public, false); assert.equal(rows[1].file_size_limit, 5242880);
    await db.exec("update storage.buckets set public=true where id='woohyukmon-event-media'");
    await assert.rejects(db.exec(sql), /MUST_BE_PRIVATE/);
  } finally { await db.close(); }
});

test('server helper rejects old resources, cross-origin mutations and revoked native tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'woo-server-test-'));
  const oldFetch = globalThis.fetch, oldEnabled = process.env.WOOHYUKMON_APP_ENABLED;
  try {
    await build({ entryPoints: ['src/lib/woohyukmonApp/server.ts'], outfile: join(dir, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', plugins: [{ name: 'isolated-test-dependencies', setup(b) {
      b.onResolve({ filter: /^(server-only|@\/auth|@\/lib\/supabaseServer)$/ }, args => ({ path: args.path, namespace: 'test' }));
      b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'server-only' ? '' : args.path === '@/auth' ? 'export async function auth(){return null;}' : 'export function getSupabaseConfig(){return {url:"https://db.invalid",serviceRoleKey:"test-not-a-secret"};} export class SupabaseRequestError extends Error {constructor(m,s){super(m);this.status=s;}}' }));
    } }] });
    const server = await import(pathToFileURL(join(dir, 'server.mjs')));
    delete process.env.WOOHYUKMON_APP_ENABLED;
    assert.throws(server.requireAppEnabled, /APP_NOT_ENABLED/);
    process.env.WOOHYUKMON_APP_ENABLED = 'true';
    for (const path of ['ecc_registrations', 'site_members', 'rpc/ecc_approve', 'woo_v1_events/../site_members']) await assert.rejects(server.appDB(path), /UNSAFE_APP_RESOURCE/);
    const actor = { id: '10000000-0000-4000-8000-000000000001', readOnly: true };
    const bearer = new Request('https://app.invalid/api', { headers: { authorization: `Bearer ${'a'.repeat(43)}` } });
    assert.throws(() => server.requireWrite(actor, bearer), /READ_ONLY_ACCOUNT/);
    assert.doesNotThrow(() => server.requireWrite(actor, bearer, true));
    assert.throws(() => server.requireWrite({ ...actor, readOnly: false }, new Request('https://app.invalid/api', { headers: { origin: 'https://attacker.invalid' } })), /INVALID_ORIGIN/);
    let lookups = 0;
    globalThis.fetch = async () => { lookups++; return new Response(JSON.stringify([{ member_id: actor.id, expires_at: new Date(Date.now() + 60000).toISOString(), revoked_at: new Date().toISOString() }])); };
    await assert.rejects(server.getActor(bearer), /SESSION_EXPIRED/); assert.equal(lookups, 1);
    await assert.rejects(server.getActor(new Request('https://app.invalid/api', { headers: { authorization: 'Bearer broken' } })), /SESSION_EXPIRED/); assert.equal(lookups, 1);
  } finally { globalThis.fetch = oldFetch; if (oldEnabled === undefined) delete process.env.WOOHYUKMON_APP_ENABLED; else process.env.WOOHYUKMON_APP_ENABLED = oldEnabled; await rm(dir, { recursive: true, force: true }); }
});
