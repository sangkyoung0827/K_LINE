# ECC Gathering Weekdays

## Release Follow-up (2026-09-14)

After the mobile release (`011a86f`, PR #27), the owner confirmed that the required
SQL had been executed. The weekday-only commit is now selected onto a separate
release branch based on that production version. The earlier local-only status
below records the implementation phase, not the current rollout decision.

Do not run SQL again or toggle live activity settings as part of deployment.
Require Browser Safety CI and the preview build before merging, then verify the
production API reports `gatheringDaysReady: true` and the UI uses the stored days.
Validate submissions and open/close permutations with synthetic fixtures only.
Club Website Builder and Hanhwal parity drafts remain excluded.

## Scope

- International Gathering applicants select Monday, Wednesday, or both.
- Writable ECC admins and higher roles independently open/close each day.
- Closing both days prevents new Gathering applications. The existing overall
  activity switch still takes precedence.
- Applicant lists show the recorded days. Historical applications remain unset.
- Membership approvals, fee handling, other activities, and Hanhwal are unchanged.
- A local grid width correction keeps the admin weekday controls accessible on
  narrow screens instead of stretching them to the applicant table's minimum width.

## Production Prerequisite

Run `supabase/ecc_gathering_days.sql` in Supabase SQL Editor before deploying the
new application version. No placeholders need replacement. This migration targets
the current application schema (`activity_id` on both ECC activity tables).

The migration is transactional and rerunnable. Existing overall activity closure,
configured weekdays on a subsequent run, applicants, RLS policies and grants are
preserved. Both weekdays are initially enabled, but a closed activity remains
closed. Existing applicants do not receive fabricated attendance days.

The new API requires at least one currently open day, and a DB trigger serializes
non-null weekday inserts against concurrent closure. NULL remains allowed for
historical rows and the older deployed application during migration-first rollout.
The API does not silently fall back to inserting a row without selected days.

Missing migration columns disable the new Gathering submission path. They do not
fabricate settings or rewrite historical data. Do not deploy until SQL succeeds.
An application rollback can leave the additive migration in place.

No production SQL, push, merge, or deployment was performed for this change.
The branch is based on local mobile-usability work that is also awaiting release;
review the release diff before deploying it.

## Verification (2026-09-14)

- `npm run test:ecc-gathering-days`: 8 passed.
- `npm run test:ecc-approval-retry`: 16 passed (approval retry, outage access and
  read-only co-developer restrictions).
- `npm run test:woohyukmon`: 29 passed.
- TypeScript, optimized build, browser metadata/safety, Hanhwal isolation and V4
  isolation checks passed.
- Remaining non-browser import, analytics, collection safety, announcements,
  journey and market collector tests passed separately.
- SQL executed twice in an isolated in-memory PostgreSQL/PGlite database. Verified
  preserved closed activity and old records, valid day combinations, invalid and
  closed-day rejection, legacy rollout compatibility and unaffected fee updates.
- Real `EccActivityPanel` tested in an isolated browser fixture with synthetic
  API responses and outbound connections disabled. Tested admin day switches,
  member-visible choices, multi-select submission, saved list display, selection
  removal on closure, and unchanged MT form.
- Korean/English layouts inspected at 320, 390, 768 and 1440 px. Weekday controls
  remain within the viewport and have at least 44 px label touch targets.
- `npm run check` is not fully green locally: the pre-existing collection test
  cannot launch system Chrome in this execution environment (SIGABRT/EPERM).
  Browser Safety CI and the full suite remain required before merge.

Local sample preview: http://127.0.0.1:3303/?role=admin
This preview does not read or write production data; reload resets its sample state.
