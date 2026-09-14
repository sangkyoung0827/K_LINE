# Social Impact Union Activity Platform V1

## Release Gate

- Base: `fa5928991815fbd66dda50e5083ddd4d4227c82f` (latest origin/main at implementation start).
- Branch: `feat/siu-activity-platform`.
- Production: **NOT DEPLOYED** until migration verification and Browser Safety CI pass.
- SQL: `supabase/siu_activity_platform_v1.sql`. Run the complete file as postgres in Supabase SQL Editor. No values need replacement.
- Migration prerequisite: the existing `user_activity_records` and Activity Preference Engine V1 migrations are already installed.
- Local PostgreSQL-compatible tests run the new SQL twice. Production SQL execution is a separate, mandatory verification.
- No production users, applications, roles or activity rows were created as test fixtures.

## Architecture Inspected

Existing SIU entry/data/QR/mark; ECC and Hanhwal official pages, activity panels, member and permission panels; NextAuth; global admin and read-only developer guards; activity rating modal/history APIs; MemoryBookStudio; My history; preference taxonomy, adapters, event SQL, hooks, reconciliation and profile calculations; mobile navigation and middleware.

Reuse: LanguageProvider/I18nText, paper-panel, existing typography, colors, responsive spacing, NextAuth, getAdminAccess, supabaseRequest, developer write guard, lucide icons, preference taxonomy and event adapters/writer/profile calculation. ECC/Hanhwal panels were inspected but not refactored into a new abstraction.

## Product

The existing logo, introduction and QR/chat block remain first. What We Do follows with Community, Local Experience, Social Innovation and Create Together. Current Activities contains at most six cards, followed by all-activities/create links.

| Route | Access / function |
| --- | --- |
| /social-impact-union | Public original entry plus What We Do/current activities |
| /social-impact-union/activities | Public published, upcoming, deadline-open activities |
| /social-impact-union/activities/create | Any logged-in K_LINE user, no club membership needed |
| /social-impact-union/activities/[id] | Public detail; drafts/hidden content restricted |
| /social-impact-union/my | Own applications and created activities, paginated |
| /social-impact-union/admin | SIU/global admins; moderation, roles and preference retry |

Creation supports plain text, canonical categories, normalized tags, optional HTTPS cover URL, start/end in KST, location/address, capacity, deadline, free/fee, preparation/contact and optional activity Open Chat. Drafts can be self-published. Creation is limited to 20 per account/day.

Apply/cancel uses the current session identity, with no duplicate member form. Duplicate applications and over-capacity inserts are prevented inside a row-locked database transaction. Reapplication preserves the original application ID/time, avoiding inflated interest signals. Cancellation keeps the row and is allowed before the activity starts, including from My Activities if moderation has hidden its content.

Creators can view applicant display names for their own activity, edit, publish, close and cancel. Admins can view all activities/applicants, hide/unhide, close and cancel. Hiding preserves the preceding status. Creators cannot override a hide. Optimistic version checks prevent stale edits. Normal UI never hard-deletes records.

## SIU Roles

Normal K_LINE users need no SIU role row. SIU roles are user, official_member, admin, super_admin and developer. Global super_admin/developer semantics and the existing read-only co-developer restriction are preserved.

Admins may grant/revoke official_member; super-admins may grant/revoke admin; the existing developer may manage SIU super-admin roles. No UI/API can grant developer or modify an equal/higher authority or self. All permission checks are server-side; role changes also enforce hierarchy transactionally. SIU grants do not grant ECC/Hanhwal access.

## Data / Privacy

New tables only:

- `siu_activities`: content, creator ownership, lifecycle/moderation timestamps.
- `siu_activity_applications`: own application, immutable interest snapshot, optional one-time rating, retry marker.
- `siu_roles`: normalized account, role and last modifying account.

New views: `siu_activity_summaries` for counts; `kline_activity_history_v1` for a read-only union of existing records and ended SIU applications.

RLS is enabled. Public/anon/authenticated SQL table/view/RPC access is revoked; authorized NextAuth server routes use service_role. No auth.uid() assumptions, public applicant identities or client service-role keys. Applicant API exposes display names/status, not emails. Role email lists require SIU admin access.

Public activity responses use an explicit projection excluding creator email and internal audit fields. Private responses carry the authenticated owner; client loads discard mismatches and abort on account changes/unmount. Mutations require same origin, login and writable access. Dates, categories, numeric bounds, tags, URLs and text lengths are validated. User HTML is never rendered.

## Preference / History / Rating

- Source is `social_impact_union`; activity ID is the SIU UUID.
- Uses the exact existing 14-category taxonomy and normalized tags; no LLM classification.
- The first application registers the activity's structured mapping in the existing map with ignore-duplicates. Later edits do not silently rewrite existing interest classification.
- Existing event adapters/writer create only applied and rating_submitted events. Idempotent keys prevent double counting after retries/reapplication.
- Preference processing is secondary via the existing after() hook. A failed signal does not undo the primary application/rating. The durable preference_synced marker allows a SIU admin to retry batches of 25 pending rows.
- Ratings are available in activity detail to applicants after ends_at, only for published/closed activities. Ratings are one-time. Cancellation/hidden/draft states do not generate rating eligibility.
- Ended SIU applications and ratings appear in My history/Memory Book through the union view. Existing ECC/Hanhwal record dates and rating writes are unchanged. My history labels SIU timestamps as activity end, not registration close.
- WooHyukmon uses the same cross-organization preference profile; no new SIU-specific chat or training pipeline.
- **Attendance, check-in, no-show and verified participation are NOT inferred or implemented.**

## Files

New:
- `supabase/siu_activity_platform_v1.sql`
- `src/lib/siu/{model,access,server,preferences}.ts`
- `src/components/social-impact-union/{SiuUI,SiuActivityForm,SiuPlatform}.tsx`
- `src/app/api/siu/access/route.ts`
- `src/app/api/siu/activities/route.ts`
- `src/app/api/siu/activities/[id]/route.ts`
- `src/app/api/siu/activities/[id]/applications/route.ts`
- `src/app/api/siu/my/route.ts`
- `src/app/api/siu/roles/route.ts`
- `src/app/api/siu/preferences/retry/route.ts`
- Five activity/create/detail/my/admin page files under `src/app/social-impact-union`
- `scripts/siu-platform.test.mjs`
- This document

Modified:
- `src/app/social-impact-union/page.tsx`: append new sections only.
- `src/middleware.ts`: public SIU list and UUID detail paths only.
- `src/app/api/activity-history/{records,timeline}/route.ts`: query read-only union.
- `src/lib/myHistory.ts`, `src/components/MyHistory.tsx`, `src/components/jeju/MemoryBookStudio.tsx`: SIU source/date labels.
- `scripts/social-impact-union.test.mjs`: preserve original entry tests and extend public/private route assertions.
- `package.json`: add SIU test to pretest.

## Verification

- New PGlite/behavior tests cover migration repeatability, legacy preservation, RLS, creator ownership, publish/edit versioning, moderation, capacity, duplicates, deadlines, cancellation/reapply, role hierarchy, rating eligibility and real preference SQL integration.
- API tests cover explicit public projection, login/read-only/origin guards, spoofed identity, private applicant access, analytics failure and account-bound responses.
- Existing member approval, role outage, gathering days, My history, preference, WooHyukmon and mobile navigation suites are retained.
- Typecheck and production build must pass; browser metadata remains untouched.
- The local full check has an existing sandbox limitation launching Chrome in the traditional-liquor collection test (`kill EPERM`). Do not weaken that test. Browser Safety CI must validate the full suite.
- Isolated UI fixtures verified actual React components at 320, 390, 700 and 1440px: create/edit/publish/apply/rate/admin controls, Korean/English, plain-text script content, no horizontal overflow. These are synthetic local fixtures, not production data.
- Production verification and migration inspection remain release gates, not assumed successes.

## Deliberate V1 Limits

Cover images are optional external HTTPS URLs. The existing Jeju upload bucket is not reused for unrelated public SIU media; local file uploads are not included in V1.

No attendance verification, payment processing, refunds, notification/email delivery, waitlists, arbitrary form builder or separate SIU AI engine. Applicant identities are limited to display names; richer contact collection requires a later explicit workflow.

The existing global ECC/Hanhwal automatic rating popup is untouched. SIU rating is available from My Activities -> activity detail.

Full-feed/admin lists use explicit pagination. Production data-dependent behavior cannot be verified before SQL deployment.

Project JIT brand cards/directories and HWA-RO/Palbok were **NOT added**. ECC/Hanhwal data was **NOT destructively modified**. The original community URL remains exactly **https://open.kakao.com/o/gOIWwoni**.
