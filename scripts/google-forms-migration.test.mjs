import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("migration is additive, private, and preserves legacy tables", async () => {
  const sql = await read("supabase/google_forms_application_migration.sql");
  assert.match(sql, /create table if not exists public\.google_forms/i);
  assert.match(sql, /create table if not exists public\.google_form_responses/i);
  assert.match(sql, /create table if not exists public\.google_oauth_connections/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all[\s\S]*anon, authenticated/i);
  assert.doesNotMatch(sql, /drop table|truncate\s+table|delete\s+from\s+public\.(ecc|siu|jeju)/i);
});

test("ECC, SIU, and Jeju retain native applications while Google migration is pending", async () => {
  const [eccApi, eccPanel, siuServer, siuPanel, jejuApi, jejuPanel] = await Promise.all([
    read("src/app/api/ecc/applications/route.ts"), read("src/components/EccActivityPanel.tsx"),
    read("src/lib/siu/server.ts"), read("src/components/social-impact-union/SiuPlatform.tsx"),
    read("src/app/api/jeju/programs/[id]/applications/route.ts"), read("src/components/jeju/JejuProgramPanel.tsx")
  ]);
  for (const source of [eccApi, siuServer, jejuApi]) {
    assert.doesNotMatch(source, /status:\s*410|NATIVE_APPLICATION_RETIRED/);
  }
  for (const panel of [eccPanel, siuPanel, jejuPanel]) {
    assert.doesNotMatch(panel, /GoogleFormApplicationLink/);
  }
  assert.match(eccPanel, /<form onSubmit=\{submitApplication\}/);
  assert.match(siuPanel, /setConfirm\("apply"\)/);
  assert.match(jejuPanel, /<form onSubmit=\{submit\}/);
});

test("Google integration keeps secrets server-side and uses official endpoints", async () => {
  const api = await read("src/lib/googleForms/googleApi.ts");
  const crypto = await read("src/lib/googleForms/crypto.ts");
  assert.match(api, /https:\/\/forms\.googleapis\.com\/v1\/forms/);
  assert.match(api, /forms\.responses\.readonly/);
  assert.match(api, /drive\.file/);
  assert.match(crypto, /aes-256-gcm/);
  assert.doesNotMatch(api, /NEXT_PUBLIC_.*TOKEN|console\.log\([^)]*token/i);
});

test("Hanhwal remains outside this migration", async () => {
  const migration = await read("supabase/google_forms_application_migration.sql");
  assert.doesNotMatch(migration, /hanhwal/i);
});

test("ECC replaces only its admin fund entry with event creation and retains native routes", async () => {
  const official = await read("src/app/ecc-official/page.tsx");
  assert.match(official, /access\.isAdmin \? \(\s*<OfficialRow\s+href="\/admin\/google-forms"\s+icon=\{FilePlus2\}/);
  assert.match(official, /ko="행사 만들기"/);
  assert.doesNotMatch(official, /ECC 자금관리|href="\/our-activities\/ecc\/fund"/);
  assert.match(official, /href="\/our-activities\/ecc\/activity"/);
  await read("src/app/our-activities/ecc/fund/page.tsx");
  await read("src/app/api/ecc/applications/route.ts");
  assert.match(official, /ml-auto shrink-0/);
  assert.doesNotMatch(official, /<ArrowRight[^>]*group-hover:translate-x/);
});
