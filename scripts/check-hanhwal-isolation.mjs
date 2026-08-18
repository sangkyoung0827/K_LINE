import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const isolatedFiles = [
  "src/lib/hanhwalAccess.ts",
  "src/lib/hanhwalActivities.ts",
  "src/lib/hanhwalActivityStatuses.ts",
  "src/lib/hanhwalMemberRegistrations.ts",
  "src/hooks/useHanhwalAccess.ts",
  "src/components/HanhwalActivityPanel.tsx",
  "src/components/HanhwalDonationPanel.tsx",
  "src/components/HanhwalFreeBoardDetailPage.tsx",
  "src/components/HanhwalFreeBoardPage.tsx",
  "src/components/HanhwalMemberRegistrationForm.tsx",
  "src/components/HanhwalMemberRegistrationManagementPanel.tsx",
  "src/components/HanhwalPermissionManagementPanel.tsx",
  "src/components/HanhwalPermissionRequestCard.tsx",
  "src/app/api/hanhwal/posts/route.ts",
  "src/app/api/hanhwal/roles/route.ts"
];

for (const file of isolatedFiles) {
  const source = read(file);

  if (/ecc_|\/api\/ecc|@\/lib\/ecc|useEccAccess|\/api\/club-board-posts|club_board_posts|freeBoardStorage/.test(source)) {
    throw new Error(`${file} contains an ECC storage or permission dependency.`);
  }

  if (/SUPABASE_SERVICE_ROLE_KEY/.test(source) && source.includes('"use client"')) {
    throw new Error(`${file} exposes a server-only Supabase credential name in client code.`);
  }
}

const migration = read("supabase/hanhwal_club_system.sql");
for (const table of [
  "hanhwal_roles",
  "hanhwal_member_registrations",
  "hanhwal_activity_applications",
  "hanhwal_activity_statuses",
  "hanhwal_fund_settings",
  "hanhwal_board_posts"
]) {
  if (!migration.includes(`public.${table}`)) {
    throw new Error(`Hanhwal migration is missing ${table}.`);
  }
}

if (!migration.includes("enable row level security") || !migration.includes("service_role")) {
  throw new Error("Hanhwal migration must keep RLS enabled and service-role-only access.");
}

const applications = read("src/app/api/hanhwal/applications/route.ts");
if (!applications.includes("access.isOfficialMember") || !applications.includes("access.isAdmin")) {
  throw new Error("Hanhwal applications must enforce official-member and admin access.");
}

const roles = read("src/app/api/hanhwal/roles/route.ts");
for (const permission of ["isOfficialMember", "isAdmin", "isSuperAdmin", "isDeveloper"]) {
  if (!roles.includes(permission)) {
    throw new Error(`Hanhwal role API is missing ${permission} enforcement.`);
  }
}

if (roles.includes("listSiteMembers") || roles.includes("site_members?select")) {
  throw new Error("Hanhwal role management must not list unrelated site accounts.");
}

const access = read("src/lib/hanhwalAccess.ts");
if (/adminAccess\.isSuperAdmin\s*\|\|\s*roleRow/.test(access)) {
  throw new Error("Global/ECC super-admin status must not grant Hanhwal super-admin access.");
}

const hanhwalPosts = read("src/app/api/hanhwal/posts/route.ts");
if (!hanhwalPosts.includes('const tableName = "hanhwal_board_posts"')) {
  throw new Error("Hanhwal posts must use the dedicated Hanhwal table.");
}

console.log("Hanhwal club isolation and permission checks passed.");
