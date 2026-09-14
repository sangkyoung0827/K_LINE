import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Hanhwal semester operations remain isolated from ECC storage", () => {
  const library = read("src/lib/hanhwalOperations.ts");
  const migration = read("supabase/hanhwal_operational_settings.sql");

  assert.match(library, /hanhwal_operational_settings/);
  assert.doesNotMatch(library, /ecc_registration_content|ecc-operations-settings/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.role\(\) = 'service_role'/);
  assert.match(migration, /on conflict \(id\) do nothing/i);
});

test("admins can open Hanhwal operations while read-only developers cannot save", () => {
  const officialPage = read("src/app/hanhwal-official/page.tsx");
  const operationsPage = read("src/app/our-activities/hanhwal/operations/page.tsx");
  const route = read("src/app/api/hanhwal/operations/route.ts");
  const card = read("src/components/HanhwalOfficialTeamChatCard.tsx");

  assert.match(officialPage, /\/our-activities\/hanhwal\/operations/);
  assert.match(officialPage, /access\.isAdmin/);
  assert.match(operationsPage, /if \(!access\.isAdmin\)/);
  assert.match(route, /isReadOnlyDeveloperEmail\(access\.email\)/);
  assert.match(card, /useReadOnlyDeveloper/);
  assert.match(card, /\/api\/hanhwal\/operations/);
});

test("Hanhwal official link and QR share the saved operational setting", () => {
  const officialPage = read("src/app/hanhwal-official/page.tsx");
  const qrRoute = read("src/app/api/hanhwal/official-team-qr/route.ts");

  assert.match(officialPage, /getHanhwalOperationalSettings/);
  assert.match(officialPage, /initialTeamChatUrl=\{operations\.officialTeamChatUrl\}/);
  assert.match(qrRoute, /getHanhwalOperationalSettings/);
  assert.match(qrRoute, /settings\.officialTeamChatUrl/);
});
