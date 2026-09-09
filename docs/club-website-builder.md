# K_LINE Club Website Builder V1

## Release Gate

- Base: `ce5f875422708ab76a736b5a0d2516707a248bdc` (latest `origin/main` fetched 2026-09-10 KST).
- Independent branch: `feat/club-website-builder`. Does not include the pending Hanhwal parity PR.
- Migration prepared but **not applied to Production**. User confirmed it has not been executed.
- Storage bucket prepared in SQL; its existence in Production has **not been verified**.
- Do not merge/deploy before `supabase/club_pages.sql` is executed and verified, and Browser Safety CI passes.
- No existing production rows were read into fixtures or changed during development.

## Architecture Inspected

Inspected package scripts/dependencies, both OFFICIAL pages, both free-board routes and components,
`eccAccess.ts`, `hanhwalAccess.ts`, `admin.ts`, `supabaseServer.ts`, root layout, shared Layout,
middleware, global CSS/Tailwind, and existing database/storage schema files. No existing builder existed.

Authorization remains NextAuth -> existing club access helper -> Next.js server -> service-role Supabase.
ECC inherits global super-admin access as its existing helper defines. Hanhwal does **not** inherit
ECC/global super-admin access: it uses its own admin/super-admin roles and the existing global developer
exception. The builder does not change either hierarchy. No Supabase browser authentication or auth.uid policies.

## Behavior

| Surface | Result |
| --- | --- |
| ECC admin+ in OFFICIAL | Build ECC Website -> `/our-activities/ecc/website/edit` |
| Hanhwal admin+ in OFFICIAL | Build Hanhwal Website -> `/our-activities/hanhwal/website/edit` |
| Normal official member | View Website -> corresponding public route, only when published |
| Logged-out editor access | Login redirect preserving callback |
| Other authenticated users | Server-rendered access denied; draft/write/media APIs return 403 |
| Public pages | `/clubs/ecc`, `/clubs/hanhwal`, published content only; unavailable state otherwise |

Shared editor, strict types, separate editor/renderer registries, and common preview/public renderer.
Seven blocks: hero, about, gallery, schedule, members, recruit, links. Four fixed themes: default,
warm, nature, mono. Pretendard is self-hosted and scoped to this module. No arbitrary style, HTML,
markdown, JavaScript or embeds. Links and image URLs are validated; text is React-escaped.

Block ordering uses dnd-kit pointer/touch and keyboard sensors. IDs remain stable. Local edits/removals
do not affect saved content until Save. Confirmed Publish atomically saves the validated current preview
and copies it to published columns. Subsequent draft saves leave the published snapshot unchanged.
Unpublish retains snapshots and uploads. Revision checks prevent simultaneous-editor overwrites.
Server errors do not clear local work. Browser unload warns about unsaved changes.

Manual schedule and public member blocks do not query club member/activity tables. Recruit links reuse
`/ecc-join` and `/hanhwal-join`. Protected team-chat links are never automatically loaded; direct
`invite.kakao.com` URLs are rejected in public link fields.

## Persistence and Media

Run `supabase/club_pages.sql` in Supabase SQL Editor. No values need substitution.
It creates only `club_pages`, its service-only transactional write RPC, two empty unpublished rows,
and the `club-page-media` public image bucket. RLS enabled, no anon/authenticated table/RPC grants.
It does not touch registration, roles, payments, activities, funds, operations or board tables.

Upload: admin authorization, same-origin write check, request body limit, 4MB file limit (below Vercel
function payload limit), JPEG/PNG/WebP only, extension and signature validation, bounded actual image
decode, re-encode and metadata removal using sharp. Limit 24 million input pixels, resize within
2400x2400. Unique server-generated paths `ecc/<uuid>.<ext>` or `hanhwal/<uuid>.<ext>`.
Only controlled bucket URLs are stored in JSON. No base64, SVG, external image URLs, GIF, arbitrary filenames.
The public bucket is for intentional public website images, not private club documents.
Unused uploads are retained to avoid deleting photos still referenced by published content.
Future orphan-media cleanup must examine both draft and published snapshots before removal.

## Files

Modified existing files only:
- `package.json`, `package-lock.json` (dependencies and isolated builder test command)
- `src/app/ecc-official/page.tsx`, `src/app/hanhwal-official/page.tsx` (board row only plus imports/publication lookup)
- `src/middleware.ts` (two public routes, two protected editor routes, self-hosted font path)

Created:
- `src/types/club-page.ts`
- `src/lib/club-page/{config,access,validation,server,http,media}.ts`
- `src/components/club-page/{ClubEditorPage,ClubWebsitePage,ClubWebsiteEditor,ClubWebsiteRenderer}.tsx`
- `src/components/club-page/{editor-registry,renderer-registry}.tsx`
- `src/components/club-page/editors/{Fields,Sections}.tsx`
- `src/components/club-page/renderers/Sections.tsx`
- `src/components/club-page/club-page.module.css`
- `src/app/clubs/{ecc,hanhwal}/page.tsx`
- `src/app/our-activities/{ecc,hanhwal}/website/edit/page.tsx`
- `src/app/api/club-pages/[clubKey]/{published,draft,publish,unpublish,media}/route.ts`
- `supabase/club_pages.sql`
- `scripts/club-website.test.mjs`
- `public/club-pretendard.woff2`, `public/club-pretendard-LICENSE.txt` (official Pretendard SIL OFL)
- This document.

Dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `sharp` (explicit image normalization dependency).
No font-picker dependency. No metadata/favicon/manifest changes.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed, all new and legacy routes compile.
- `npm run test:club-website`: 13 tests passed (schema, limits, URL/image isolation, real image decode,
  all API access gates, cross-club roles, save/publish/unpublish separation, stale revision, public response
  minimization, upload storage path/secret isolation, CSRF and invalid payloads).
- `npm run check`: invoked. New tests, WooHyukmon tests and typecheck passed; existing traditional-liquor
  Chromium test cannot launch Chrome in the local sandbox (`SIGABRT` / kill `EPERM`). Do not classify this
  as full local check success; require complete GitHub Browser Safety CI before merge.
- SQL executed three times in isolated PGlite/PostgreSQL: idempotence, draft/public separation, conflict
  rejection, grants/RLS, bucket and preservation of unrelated fixture tables passed. This is NOT a
  production migration or production storage verification.
- Browser fixture uses the actual editor/renderers with in-memory APIs, never real member data.
  Desktop 1280x900, mobile 390x844, tablet 768x1024 inspected. Added all seven blocks, edited text,
  changed theme, saved, reordered with keyboard, published with confirmation, switched mobile tabs,
  rejected an invalid link without losing input. Public snapshot stayed unchanged after later draft save.
- Production-authenticated upload/save/publish and actual Supabase storage are pending migration and release.

## Preservation / Rollback

Legacy board components, APIs, post detail routes, storage helpers and all old posts remain intact.
No authentication, registration, payment, approval, role, activity, fund, semester-operation,
WooHyukmon, My Journey, Navbar, homepage, admin dashboard or browser metadata changes.
Shared Layout including GlobalWoohyukmonGate is untouched.
Rollback the feature commit/PR to restore official board links; leave the additive DB table and bucket
in place rather than deleting content. Never roll back by deleting existing production club data.

## Remaining Before Production

1. Run migration and verify two unpublished rows plus bucket.
2. Require CI and preview build success.
3. Verify authorized editor save/upload/publish in a deliberate test club/page workflow; publication is public.
4. Merge PR and verify Vercel production deployment SHA and public/private route behavior.
5. Keep actual ECC/Hanhwal membership writes out of release smoke tests.
