import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(path, 'utf8');
const normalizeEmail = value => value?.trim().toLowerCase() || '';
class SupabaseRequestError extends Error { constructor(status) { super('Storage unavailable'); this.status = status; } }
class SupabaseConfigError extends Error {}
const storage = request => ({
  supabaseRequest: request,
  cleanText: (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '',
  SupabaseRequestError, SupabaseConfigError
});

// Execute real server modules with request-local auth/storage mocks, never live DB data.
function loader(mocks) {
  const cache = new Map();
  const load = file => {
    const absolute = resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const output = ts.transpileModule(read(absolute), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true
    }}).outputText;
    const module = { exports: {} };
    cache.set(absolute, module.exports);
    const localRequire = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) {
        const p = resolve('src', name.slice(2));
        return load(existsSync(`${p}.ts`) ? `${p}.ts` : `${p}.tsx`);
      }
      return require(name);
    };
    vm.runInNewContext(output, {
      require: localRequire, module, exports: module.exports,
      console: { ...console, error() {} }, process: { env: {} },
      URL, Response, Request, crypto: globalThis.crypto, setTimeout, clearTimeout
    }, { filename: absolute });
    cache.set(absolute, module.exports);
    return module.exports;
  };
  return load;
}

function access(role = 'user', loggedIn = true) {
  const rank = ['user','official_member','admin','super_admin','developer'].indexOf(role);
  return { email: loggedIn ? 'member@example.test' : '', isLoggedIn: loggedIn,
    role, isOfficialMember: rank >= 1, isAdmin: rank >= 2, isSuperAdmin: rank >= 3, isDeveloper: rank >= 4 };
}
function mocksFor(role, request = async () => [], loggedIn = true) {
  return {
    '@/lib/admin': { normalizeEmail, isDeveloperEmail: email => email === 'developer@example.test', getDeveloperEmails: () => [] },
    '@/auth': { auth: async () => loggedIn ? {user:{email:'member@example.test'}} : null },
    '@/lib/hanhwalAccess': { getCurrentHanhwalAccess: async () => access(role, loggedIn) },
    '@/lib/supabaseServer': storage(request),
    'next/server': { NextResponse: Response }
  };
}

test('Hanhwal role ladder never inherits another club/global super-admin status', async () => {
  for (const [row, global, expected] of [
    [null, {isDeveloper:false,isSuperAdmin:true}, 'user'],
    [{official_member_status:'approved'}, {isDeveloper:false,isSuperAdmin:true}, 'official_member'],
    [{admin_status:'approved'}, {isDeveloper:false}, 'admin'],
    [{super_admin_status:'approved'}, {isDeveloper:false}, 'super_admin'],
    [null, {isDeveloper:true}, 'developer']
  ]) {
    const load = loader({
      '@/auth': {}, '@/lib/admin': { normalizeEmail, getAdminAccess: async () => global },
      '@/lib/supabaseServer': storage(async path => {
        assert.ok(path.startsWith('hanhwal_roles?'));
        return row ? [row] : [];
      })
    });
    assert.equal((await load('src/lib/hanhwalAccess.ts').getHanhwalAccessForEmail('member@example.test')).role, expected);
  }
});

test('Non-admins cannot mutate settings, funds, catalogue, approvals or alumni', async () => {
  const routes = [
    ['fund','PATCH'], ['operations','PATCH'], ['registration-content','PATCH'],
    ['activity-catalog','POST'], ['activity-catalog','PATCH'], ['activity-catalog','DELETE'],
    ['activity-statuses','PATCH'], ['member-registrations','PATCH'], ['roles','PATCH'],
    ['../hanhwal-alumni/notices','POST'], ['../hanhwal-alumni/inquiries','PATCH'],
    ['../hanhwal-alumni/rejoin-requests','PATCH']
  ];
  for (const role of ['user','official_member']) {
    for (const [route, method] of routes) {
      let writes = 0;
      const load = loader(mocksFor(role, async () => { writes++; return []; }));
      const handler = load(`src/app/api/hanhwal/${route}/route.ts`)[method];
      const response = await handler(new Request('https://example.test/api', {
        method, ...(method === 'DELETE' ? {} : {body:JSON.stringify({displayedBalance:1,title:'test'})})
      }));
      assert.equal(response.status, 403, `${role} ${route} ${method}`);
      assert.equal(writes, 0, route);
    }
  }
});

test('Official team QR and balance are not exposed to non-members/non-admins', async () => {
  for (const role of ['user','official_member']) {
    const load = loader(mocksFor(role, async () => { throw new Error('Unexpected DB call'); }));
    assert.equal((await load('src/app/api/hanhwal/fund/route.ts').GET()).status,403);
    if (role === 'user') assert.equal((await load('src/app/api/hanhwal/official-team-qr/route.ts').GET()).status,403);
  }
});

test('Registration reset is developer-only and one organization-scoped RPC', async () => {
  for (const role of ['admin','super_admin']) {
    const load = loader(mocksFor(role, async () => { throw new Error('Unexpected write'); }));
    const route = load('src/app/api/hanhwal/member-registrations/route.ts');
    assert.equal((await route.DELETE(new Request('https://example.test/api?id=test',{method:'DELETE'}))).status,403);
    const roles = load('src/app/api/hanhwal/roles/route.ts');
    assert.equal((await roles.PATCH(new Request('https://example.test/api',{method:'PATCH',body:JSON.stringify({action:'reset_hanhwal_member_data',email:'other@example.test'})}))).status,403);
  }
  const calls=[];
  const load=loader(mocksFor('developer',async (path,init)=>{calls.push([path,JSON.parse(init.body)]);return null;}));
  const reset=load('src/lib/hanhwalMemberDeletion.ts').resetHanhwalMemberRegistrationData;
  await reset(' MEMBER@example.test ');
  assert.deepEqual(calls,[['rpc/reset_hanhwal_member_registration',{target_email:'member@example.test'}]]);
  await assert.rejects(()=>reset('developer@example.test'));
  assert.equal(calls.length,1);
});

test('Unchanged approval performs no write; note-only change does not change membership', async () => {
  const calls=[];
  const row={id:'id',google_email:'member@example.test',payment_confirmed:true,official_member:true,status:'approved',admin_note:'note',created_at:'2026-01-01'};
  const load=loader(mocksFor('admin',async (path,init)=>{if(init)calls.push(JSON.parse(init.body));return [row];}));
  const patch=load('src/lib/hanhwalMemberRegistrations.ts').patchHanhwalMemberRegistrationWithChangeInfo;
  assert.equal((await patch({id:'id',adminEmail:'admin@example.test',adminNote:'note',paymentConfirmed:true})).changed,false);
  assert.equal(calls.length,0);
  await patch({id:'id',adminEmail:'admin@example.test',adminNote:'updated',paymentConfirmed:true});
  assert.deepEqual(Object.keys(calls[0]).sort(),['admin_note','updated_at']);
});

test('Activity open closes other activities and scopes history to Hanhwal', async () => {
  let updates;
  const history=[];
  const load=loader({
    '@/lib/hanhwalOperations': {getHanhwalActivityCatalog:async()=>[{id:'gathering',archived:false},{id:'mt',archived:false},{id:'old',archived:true}]},
    '@/lib/hanhwalActivityStatuses': {updateHanhwalActivityStatuses:async value=>{updates=value;return {closedActivities:[{activityId:'gathering'}]};}},
    '@/lib/userActivityRecords': {markActivityApplicationsClosed:async source=>history.push(source),createActivityRecordsForClosedActivities:async source=>history.push(source)}
  });
  await load('src/lib/hanhwalActivityAdminActions.ts').applyHanhwalActivityStatusAdminUpdate({adminEmail:'admin@example.test',updates:{mt:true,old:true}});
  assert.equal(updates.mt,true);
  assert.equal(updates.gathering,false);
  assert.equal(updates.old,undefined);
  assert.deepEqual(history,['hanhwal','hanhwal']);
});

test('Registration and operations retain Hanhwal defaults when additive storage is absent', async () => {
  const load=loader({
    '@/lib/supabaseServer':storage(async()=>{throw new SupabaseRequestError(404);}),
    '@/lib/hanhwalAccess':{defaultHanhwalOfficialTeamChatUrl:''}
  });
  const content=await load('src/lib/hanhwalRegistrationContent.ts').getHanhwalRegistrationContent();
  assert.match(content.body,/traditional archery/);
  assert.doesNotMatch(content.body,/3333|15,000|ecc/i);
  const settings=await load('src/lib/hanhwalOperations.ts').getHanhwalOperationalSettings();
  assert.equal(settings.officialTeamChatUrl,'');
  assert.equal(settings.inquiryChatUrl,'');
  const catalog=await load('src/lib/hanhwalOperations.ts').getHanhwalActivityCatalog();
  assert.equal(catalog.length,6);
  assert.match(catalog[0].titleEn,/Archery/);
});

test('Closed Hanhwal activities cannot receive applications', async () => {
  let writes=0;
  const mocks=mocksFor('official_member',async (_path,init)=>{if(init)writes++;return [];});
  mocks['@/lib/hanhwalOperations']={getHanhwalActivityCatalog:async()=>[{id:'gathering',archived:false,titleEn:'Practice'}]};
  mocks['@/lib/hanhwalActivityStatuses']={getHanhwalActivityStatuses:async()=>({statuses:{gathering:false},requiresPayment:{gathering:true},activityInstances:{}})};
  const handler=loader(mocks)('src/app/api/hanhwal/applications/route.ts').POST;
  const result=await handler(new Request('https://example.test/api',{method:'POST',body:JSON.stringify({activity_id:'gathering',name:'Test',gender:'Etc',nationality:'KR',preferred_food:'None'})}));
  assert.equal(result.status,403);
  assert.equal(writes,0);
});

test('Middleware adds Hanhwal protection without changing existing ECC routing', async () => {
  const middleware=loader({'next/server':{NextResponse:{next:()=>({next:true}),redirect:url=>({redirect:url.toString()})}}})('src/middleware.ts').middleware;
  for(const club of ['ecc','hanhwal']) {
    for(const pathname of [`/our-activities/${club}`,`/${club}-alumni`, `/${club}-alumni/notices`]) {
      const result=await middleware({nextUrl:{pathname,search:''},url:`https://example.test${pathname}`,cookies:{getAll:()=>[]}});
      assert.equal(result.next,true,pathname);
    }
    for(const pathname of [`/${club}-join`,`/${club}-official`,`/our-activities/${club}/members`,`/our-activities/${club}/fund`]) {
      const request={nextUrl:{pathname,search:''},url:`https://example.test${pathname}`,cookies:{getAll:()=>[]}};
      assert.equal(new URL((await middleware(request)).redirect).searchParams.get('callbackUrl'),pathname);
      assert.equal((await middleware({...request,cookies:{getAll:()=>[{name:'authjs.session-token'}]}})).next,true);
    }
  }
});
