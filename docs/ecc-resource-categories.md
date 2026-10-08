# ECC Resource Categories

The existing K_LINE website resource library now supports Class & research,
Notices, MT materials, Special events and Other. Uploaders select a category;
everyone can combine the category filter with the existing text search.
ECC administrators can change a published resource's category from its detail
page. Upload and administrator access continue to use the original access helper,
including the read-only developer restriction. Published file downloads remain public.

## Database Prerequisite

Apply `supabase/migrations/20261008175316_ecc_resource_categories.sql` before
releasing the code. It adds one checked column with a default of `other`.
Existing documents, descriptions, storage paths, owners and publication dates
are preserved. Reapplying the SQL leaves manually assigned categories unchanged.
No membership, payment, board, memory or application tables are modified.
Before the migration, legacy public reads still work and show Other.
New uploads and category edits require the migration; do not release early.

## Local Verification

- `npm run test:ecc-resource-library`: category validation, combined filtering,
  migration repeatability, data preservation, RLS and administrator-only edits.
- `npm run typecheck` and `npm run build`.
- `node scripts/ecc-resource-categories-preview.mjs` starts a localhost-only
  isolated fixture at `http://127.0.0.1:3341/our-activities/ecc/resources`.
  `?role=public`, `?role=member`, and `?role=admin` simulate the three UI states;
  `&language=en` switches the fixture language. The fixture is not real auth QA.
  It uses in-memory sample documents and never connects to production storage.

No production migration or deployment is included in this change.

## Verification Results (2026-10-09)

- All 19 focused model, route and isolated Postgres tests passed.
- Typecheck, production build and browser metadata safety checks passed.
- The actual components were tested in the isolated fixture: combined search and
  category filtering, administrator reclassification and refresh persistence,
  member upload with category preservation, public viewing without edit controls,
  Korean/English controls, and 320/390px mobile widths without horizontal overflow.
- `npm run check` passed the feature pretest suites but stopped at the unrelated
  traditional-liquor collection test because sandboxed Chrome could not launch.
  The full regression suite is not reported as passed. Repeat it in CI before merge.
- Real production authentication/storage and production SQL execution remain
  release-time verification steps; the preview uses synthetic in-memory data.
