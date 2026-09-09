# Hanhwal Club Parity

## Scope

Hanhwal uses the existing ECC club workflows through separate Hanhwal modules.
ECC modules, tables, stored data, public assets and browser metadata are unchanged.
The shared middleware changes only add Hanhwal routes; ECC route behavior is covered by regression tests.

| Area | Hanhwal implementation |
| --- | --- |
| Registration | Existing Hanhwal registration content retained; admin inline editing, new draft, save, authenticated submission, callback preservation, post-submission/approval visibility |
| Members | Search all application fields, top save button, changed-row writes, payment confirmation and official membership, developer-only club registration reset |
| Roles | Official member/admin/super-admin/developer ladder; only site developer status is inherited; no global or ECC super-admin inheritance |
| Activities | Six existing archery activity IDs retained; dynamic add/edit/archive; one open activity at a time; open/close and payment requirements; admin applicants, teams and notices |
| History | Existing user activity history/rating integration uses source `hanhwal`; no changes to shared history storage or ECC behavior |
| Funds | Admin-only page/API; manual current balance and remaining amount; existing balance retained |
| Team chat | Hanhwal-specific semester/link settings and generated QR; no borrowed ECC invite; unset links render an explicit unconfigured state |
| Alumni | Separate notices, participation inquiries, personal status and rejoin requests; Hanhwal-only admin management |
| Board | Existing dedicated Hanhwal posts API/table and board UI retained, including member access and admin deletion |

## Deployment Order

1. Run `supabase/hanhwal_ecc_parity.sql` in the existing project's Supabase SQL Editor.
   No placeholder values need editing. It requires the previously installed Hanhwal base tables.
   It creates content/alumni tables, relaxes only Hanhwal's six-ID activity constraints,
   adds missing history columns, and creates the service-role-only atomic membership-reset RPC.
   It does not seed members, payments, posts, account numbers, balances or chat links.
2. Confirm the migration succeeded. Do not merge/deploy the feature before that confirmation.
3. Require the Browser Safety PR workflow to pass, then merge and verify the resulting deployment.
4. A Hanhwal administrator should set the actual chat links and semester under
   `/our-activities/hanhwal/operations`, and edit registration instructions if needed.
   Existing `HANHWAL_OFFICIAL_TEAM_CHAT_URL` remains a fallback.
   Optional `HANHWAL_OPEN_CHAT_URL` and `HANHWAL_INQUIRY_CHAT_URL` are also supported.

The existing `user_activity_records` migration is already shared by both clubs.
This feature does not rewrite or migrate historical application ownership by guessing names.

## Validation

- Typecheck and production build passed locally.
- Hanhwal isolation scanner now recursively covers all Hanhwal modules and APIs.
- Behavioral tests cover role isolation, blocked admin writes, private QR/funds,
  developer-only reset, delta approvals, single-open activity/history scoping,
  closed applications, missing additive schema read fallback, and ECC/Hanhwal routing.
- The SQL was executed twice against an isolated PostgreSQL-compatible PGlite database:
  existing records remained identical, new activity IDs worked, RLS/grants were checked,
  and reset removed only the target Hanhwal registration and roles.
- Local browser QA used actual components with synthetic, memory-only API fixtures:
  390px member search/check/save, single open activity for official members,
  approved-member registration instructions, and 1280px admin content editing/funds.
  No live member approvals, deletions or payment writes were performed.
- Full local `npm run check` reaches the pre-existing Chrome fixture failure
  (`SIGABRT` / `kill EPERM` in this sandbox). Full GitHub Browser Safety CI is required.

## Rollback

Revert the feature code if necessary. Leave the additive Hanhwal tables/columns in place;
do not delete newly stored registration instructions, alumni requests or member records.
