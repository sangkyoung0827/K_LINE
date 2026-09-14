# Activity Preference Engine V1

## Release Status

- Inspected base: `08d4d3b9f0d024b76ee57147f0d6fb6b51212590` (`origin/main`, fetched 2026-09-14).
- Work branch: `feat/activity-preference-engine-v1`.
- The initial deployment hold was lifted on 2026-09-14. The user explicitly selected application/rating-only deployment. Sensitive information and conversation-to-score analysis are excluded. PR #29 is the isolated release; held builder/parity work remains excluded.
- Production has not been used as a test environment. No real application, membership, payment, rating, role, or setting was changed.
- Release evidence: PR #29 records the final merge/deployment and post-deployment checks. Historical backfill completed on 2026-09-14 16:03 KST: 128 events from 125 ECC applications and 3 explicit ratings, 100 private profiles. An immediate repeat added 0 events. Errors, missing identities, unmapped activities and unsupported/attendance events were all 0. Only new preference tables were written.

## Inspected Architecture

Next.js 15 App Router / React 19; Google NextAuth JWT sessions (`src/auth.ts`); server-authorized Supabase REST through `supabaseServer.ts`. No Supabase Auth identity migration. Existing read-only developer enforcement remains in place.

ECC POST `/api/ecc/applications` authorizes official membership, validates the current catalog/status and Gathering days, then inserts one source application. Hanhwal POST `/api/hanhwal/applications` uses its own access/status helpers and source table. Both associate `user_id` with the session email when the activity-history schema/instance is available; legacy fallback writes may lack identity. Preference hooks capture the successful insertion ID/time and the actual instance, plus the authenticated email. They do not use a client-supplied email or activity title for identity.

`ActivityRatingModal` PATCH `/api/activity-history/rating` calls `rateActivityRecord()`. It updates only the authenticated user's unscored, non-dismissed record and stores rating/rated_at. After success, the new hook reads that exact record with the same owner filter. Dismissals are not signals. Existing record creation uses closure/payment eligibility, which is **not evidence of attendance** and is not used by this engine.

Reviewed all references to `ecc_activity_applications`, `hanhwal_activity_applications`, `user_activity_records`, `ActivityRatingModal`, and the shared activity IDs/instances. Other readers include history, Jeju assistant context, legacy Woohyukmon live data, activity operations and board assistant context; these are left unchanged.

`WoohyukmonChatbot` and `GlobalWoohyukmon` use `/api/gemini` for generated NDJSON answers; Global first tries `/api/woohyukmon/operations`. The legacy `/api/woohyukmon` JSON answer route is also covered. Generation providers/failover, heartbeat/streaming, Tavily/search, training data, conversation memory and UI remain intact. Preference intent bypasses admin operation routing, and unrelated conversations do not query the engine.

## Canonical Classification

Identity is `source + activity_id`, never localized title. Normalized email (`trim`, `lowercase`) is the private `user_key`. `site_members.id` could be resolved later, but no site-wide migration is attempted. Historical source rows without `user_id` are skipped/reported; names, demographics or contacts are never used to guess ownership.

Fourteen categories live in `taxonomy.ts`: social_networking, party_nightlife, culture_tradition, travel, food, outdoor, sports, wellness, volunteering, education, career, creative, language_exchange, local_exploration. Each has English/Korean labels and a description. Tags are separate activity descriptors.

Initial manual mappings are conservative and preserve administrator changes when SQL is rerun:

| Source/ID | Categories | Evidence |
| --- | --- | --- |
| ecc/opening | social_networking | `eccOperations.ts` semester opening catalog and application copy |
| ecc/gathering | social_networking | Explicit international exchange gathering description |
| ecc/farewell | social_networking | Semester closing gathering copy |
| ecc/english-class | education, language_exchange | Explicit English Class |
| ecc/mt, ecc/special | none yet | Descriptions do not establish a specific format |
| hanhwal/gathering, mt, special, opening, farewell | sports, culture_tradition | `HanhwalActivityPanel.tsx` explicitly describes Korean archery practice/events |
| hanhwal/english-class | sports, culture_tradition, education | Explicit beginner archery class, not an English lesson |

ECC Gathering does not receive language_exchange merely because ECC is an English club. Opening/farewell do not receive party_nightlife merely because their English names contain Party. Unknown/inactive/unclassified mappings retain events with empty dimensions and appear in aggregate diagnostics. Rerun reconciliation after a manual mapping change, including removal of a classification.

## Deterministic Model

`config.ts` owns model `v1`, application weight `+2`, rating weights 1:`-3`, 2:`-1`, 3:`0`, 4:`+2`, 5:`+4`, half-life `180` days, affinity scale `10`, confidence scale `4`.

- Application key: `<source>_application:<source row id>`.
- Rating key: `activity_rating:<record id>:<rated_at normalized to ISO UTC>`.
- Active types: `applied`, `rating_submitted` only. Future created/saved/explicit-preference TypeScript types are reserved but rejected by the V1 writer and SQL constraint.
- Rating requires both non-null `rating` and `rated_at`, with rating an integer from 1 through 5.
- `effectiveWeight = baseWeight * 2^(-max(0, ageDays)/180)`.
- Raw dimension score is the sum of effective weights.
- `affinity = clamp(50 + 50*tanh(raw/10), 0, 100)`.
- `confidence = clamp(1-exp(-signalCount/4), 0, 1)`.
- Full weight is applied once to every unique assigned category and tag. A dimension's counts are not summed across dimensions for user totals.
- An absent category is returned with affinity 50 and confidence 0, meaning unknown, not dislike. Neutral 50 is not an average person's preference.
- A low rating can weaken application-derived interest. No attendance, enjoyment, no-show or sensitive attributes are inferred from application alone.

Events are the source of truth; profiles and profile-state totals are derived. The DB aggregation receives model constants from the server config; it uses the algebraically equivalent bounded logistic form of tanh. Pure TypeScript aggregation is the reference implementation and is compared against actual PostgreSQL results in tests.

The recomputation RPC takes a per-user row lock, captures one event snapshot, and atomically replaces only that user's derived dimensions and counts. Concurrent hooks do not overwrite a newer profile using a pre-lock stale application scan. Failed transactions retain the previous complete profile. Reconciliation can repair failures. Old source events are not deleted when an existing admin resets an application list.

Reads use only a single coherent precomputed profile RPC, never scan application history. Between recomputations the server analytically decays stored raw scores to read time (linearity of exponential decay), then applies the same affinity function; counts/confidence remain evidence counts. Real source timestamps must be valid server-generated timestamps. `computedAt` and `asOf` distinguish the last aggregation and read time.

## Modules and APIs

New `src/lib/activity-preferences/` modules:

- `taxonomy.ts`, `config.ts`, `types.ts`, `identity.ts`: centralized model contracts.
- `adapters/applications.ts`, `adapters/ecc.ts`, `adapters/hanhwal.ts`, `adapters/ratings.ts`: allowlisted source extraction; no demographics, payments, messages or GPS.
- `store.ts`, `mappings.ts`, `events.ts`: bounded server REST, explicit mapping, validated idempotent events.
- `scoring.ts`, `aggregate.ts`, `profile.ts`, `server.ts`: deterministic formulas, recomputation and private profile reads.
- `hooks.ts`: Next `after()` scheduling; both scheduling errors and deferred task errors are contained. Primary application/rating response never waits for analytics.
- `reconcile.ts`: dry-run/apply source scans, retained-event remapping, affected-user recomputation and aggregate run reporting.
- `recommend.ts`: server-only activity ranking from category/tag affinity and confidence.
- `intent.ts`, `woohyukmon.ts`: narrow intent matching, compact profile summaries, truthful error/unknown state and explanation rules.

`GET /api/activity-preferences/me` derives identity solely from the current NextAuth session; request query/body cannot select an owner. Unauthenticated users get 401, analytics failures get 503 rather than fake zero scores. Returns all categories and observed tags, counts, ratings, confidence, model version and dates; never returns `user_key`. Cache-Control is private/no-store with Vary Cookie. No score-write API exists.

`GET /api/activity-preferences/diagnostics` is developer/super-admin-only and returns aggregate counts, unmapped activity IDs and latest reconciliation. It has no individual preference browser or member list. An additional diagnostics UI is optional and is not added, so layout and navigation do not change.

Ranking averages `(affinity - 50) * confidence` across each candidate's unique category/tag dimensions, then adds 50. Missing evidence contributes zero rather than a penalty. Ties sort by source/ID. Explanations expose the exact contributing engine values. Recommendations only use currently open application types, excluding archived ECC entries and Gathering with no open weekdays; they do not claim dates, verified eligibility or attendance. Existing club access controls still govern actual applications.

Woohyukmon receives strongest categories (confidence >= 0.7 and positive affinity), emerging categories (positive affinity, limited evidence), lower/neutral categories, insufficient-data categories, top tags and aggregate source-event counts. It also receives ranked open application candidates. The private profile has a 5-second read deadline. The optional open-activity catalog has a separate 2.5-second deadline and concurrent, abortable source reads: its failure cannot discard a successfully loaded profile. It never writes or invents scores. Login-required, unavailable and insufficient-evidence states are distinct. Explicit external research still follows the existing search policy. SIU is not fabricated; its future adapter can call the shared application/rating functions with creator-selected structured classifications.

Post-deployment QA found the original shared 5-second deadline expiring while optional candidates were still loading. The authenticated self-profile API returned 200, but chat incorrectly lost that valid profile. The follow-up isolates these deadlines and adds stalled/failed-catalog regression tests. It does not alter member data, permissions or original chat storage. A separate existing chat-create request encountered a Supabase 504 and a later request returned 201; that storage behavior is not modified by this feature.

## Migration and Security

New file: `supabase/activity_preferences_v1.sql`.

Creates three requested tables plus two support tables:

1. `activity_preference_activity_map`
2. `activity_preference_events`
3. `user_activity_preferences`
4. `activity_preference_profile_state` (per-user lock and coherent totals)
5. `activity_preference_reconciliation_runs` (aggregate run audit)

Includes indexes, unique canonical/event keys, V1 event/rating checks, manual seed mappings, mapping timestamp trigger, event/recompute/read/diagnostics RPCs and schema-cache notification. RLS is enabled on all five tables. PUBLIC/anon/authenticated have no table or RPC access; only server service_role has access. No `auth.uid()` application identity policies. RPCs are security-invoker and set their search path. No browser service-role credential or new client DB SDK is added.

The migration never alters or deletes existing ECC/Hanhwal/history/auth tables. `DELETE` inside the recomputation function only replaces the current user's derived preference rows within its transaction. Applying SQL alone creates empty analytics tables and classification seeds, not behavioral events.

**Production migration verified on 2026-09-14:** all five tables have RLS; anon/authenticated cannot select them or execute the four RPCs; service_role can. The database initially contained 0 events/profiles and 10 classified activity mappings. Source preflight found 125 ECC applications with identity and 3 explicit ratings; no Hanhwal application rows. No individual member information was returned to the diagnostic UI.

## Production Runbook

Proceed only after the user explicitly reauthorizes the release:

1. Refresh/rebase against current production main and rerun all regression gates, including green Browser Safety CI. Review the final diff; keep held builder/parity branches separate.
2. Apply the complete new SQL file through the owner's Supabase SQL Editor. No placeholders need editing. Verify tables, RPCs and denied anon/authenticated access before backfill.
3. In a trusted server-only shell with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` supplied securely, run `npm run reconcile:activity-preferences`. This is a read-only dry run by default. Never paste secrets into chat or commit environment files.
4. After tests, typecheck, build and migration are verified: `npm run reconcile:activity-preferences -- --apply --gates-passed`. It re-reads/counts sources immediately before writing, logs counts only, and exits nonzero on errors.
5. Run it again and verify newEvents=0 for unchanged sources, matching unique keys, attendanceEvents=0, expected source conversions, profiles and unmapped activities. Source rows without identity remain reported/skipped, never guessed. Inspect any errors before release.
6. Deploy the reviewed application branch after merge authorization, then run reconciliation once more to catch applications submitted between the first backfill and deployment. Check authenticated self-profile privacy, live hooks on controlled test data, mobile/desktop chat and normal club application flows.
7. Use a maintenance reconciliation when mappings change, after a failed ingestion, and as part of later operational maintenance. No new scheduler or cron is created in this task.

The production service credentials are protected/redacted on Vercel export, so the owner SQL Editor can instead run `supabase/activity_preferences_backfill.sql`. It defaults to dry-run, uses temporary tables, and calls the same event/recompute RPCs. Change only `kline.preference_apply` from `false` to `true` after passing release gates. Source projection, rating timestamp keys, V1 weights, repeat execution and source-table invariance are checked against the adapters in PostgreSQL tests. The entire write run is transactional: an error rolls it back. This alternative creates no permanent functions, credentials or expanded grants. Run again to verify zero new events on unchanged sources.

Rollback: revert only this feature commit through a reviewed PR; do not drop event/history tables or edit source history. Existing source flows continue without analytics.

## Verification and Limitations

- New preference tests: 29 passing, covering all requested behavior groups including source adapters, weights/confidence/decay, duplicate keys, localization, private self API, non-blocking real ECC/Hanhwal/rating route hooks, unknown mapping repair, future/attendance rejection, recommendation values and Woohyukmon restrictions. The additional SQL Editor backfill test verifies default dry-run, adapter-compatible millisecond rating keys, repeat execution and unchanged source rows.
- Embedded PostgreSQL (PGlite) ran the actual migration twice, actual event/upsert/recompute/read RPCs, immutable identity conflict, remapping, role grants/RLS and SQL-versus-TypeScript score comparison. These are isolated fixtures, NOT production records.
- The reconciliation test scans 3 synthetic ECC rows (one lacks identity), 1 synthetic Hanhwal row and 1 synthetic rating, yielding 4 events; rerunning adds none. These numbers do not describe production.
- Existing Woohyukmon tests (29), ECC approval/access/read-only developer tests (16), My Clubs (7), mobile navigation (5), Gathering weekdays (8) passed. Existing import/analytics/intents, business collection, ECC notice, Jeju and market-collector tests also passed separately.
- `npm run check` was run but stopped at the existing traditional-liquor browser fixture: local Chrome aborted with EPERM/SIGABRT under this environment. The failing test was not deleted, disabled or weakened. The full equivalent Browser Safety CI passed on release commit `5d40e50` (run `34815859949`), including npm test, build and V4 isolation. The final PR head must also be green before merge.
- Typecheck and production build passed locally; browser metadata, Hanhwal isolation and V4 isolation validators passed. Final validation output is recorded at handoff.
- CLI without credentials fails before any DB operation, as intended.
- Local built-server smoke check (2026-09-14): `/api/activity-preferences/me` and the same path with another email query both returned 401/private-no-store without a session; POST returned 405; diagnostics returned 401/private-no-store. The temporary verification server was stopped afterward. No production credentials were used.
- Built client chunks contain none of the preference write/recompute RPC names, `SUPABASE_SERVICE_ROLE_KEY` or PGlite. Tracked diffs for components, layout/styles, auth, club access, member registration stores, original activity-record module and browser metadata are empty.
- npm reported 10 dependency advisories for the current dependency tree during test-tool installation. No broad audit fix or unrelated dependency upgrade was performed; review these separately before production release.
- No real provider-answer, login, payment, member change or application was submitted for production QA. Automated mocked-source tests verify those integration boundaries; live authenticated regression remains a deferred release gate.
- Historical applications without user identity cannot be safely backfilled. If a legacy schema fallback omits identity and its after-response hook fails, reconciliation cannot repair that row without a separately verified identity source.
- Inactive/unclear mappings intentionally produce no category evidence. No per-user editing UI, SIU source implementation, attendance inference, demographic features or chat-to-score updates are included.

## Requested Final Report Checklist

| Item | Result |
| --- | --- |
| 1. Base SHA | `08d4d3b9f0d024b76ee57147f0d6fb6b51212590` |
| 2-4. Architecture/application/rating inspection | Documented above; NextAuth, independent club POSTs, owner-filtered rating PATCH |
| 5. Created files | Engine directory, private API directory, three scripts, new SQL and this report |
| 6. Modified files | ECC/Hanhwal application routes; rating route; Gemini, legacy Woohyukmon and operations routes; package/lock; existing Gathering test dependency stub |
| 7-8. Migration | Created and tested twice locally; production tables, RPCs and RLS verified |
| 9-10. Taxonomy/mappings | 14 categories; 12 conservative canonical mappings including 2 unclassified ECC activities |
| 11. Events | applied + rating_submitted; unique deterministic source keys |
| 12-15. Weights/formulas | Centralized V1 values, 180-day decay, tanh affinity, separate exponential confidence |
| 16-18. Adapters | ECC, Hanhwal, explicit ratings implemented |
| 19. Live hooks | After-response attempts; original business result remains primary |
| 20. Reconciliation | Dry run by default, idempotent apply, unknown mapping repair, safe aggregate logging |
| 21. Woohyukmon | Conditional read-only compact context, deterministic rankings, no score-write action |
| 22. Self API | Session-owned, no owner override, no-store, 401/503 distinctions |
| 23. Recommendations | Server-only affinity x confidence matching, neutral unknown evidence |
| 24. Production source rows scanned | Preflight: ECC 125, Hanhwal 0, explicit ratings 3; all source rows have identity |
| 25-26. Production events/profiles created | 128 events, 100 profiles; rerun added 0 events |
| 27-28. Production unmapped/duplicates | Both 0; 128 events equal 128 unique source keys |
| 29. Attendance events | 0 in production; only applied/rating_submitted supported |
| 30. Privacy/security | RLS/grants, owner-only API, empty event metadata, restricted diagnostics tested |
| 31. Tests | 29 preference tests pass; regression results and one local browser limitation above |
| 32-33. Typecheck/build | Passed locally |
| 34-35. Production migration/backfill | Migration verified; SQL Editor backfill and repeat completed without exporting private rows |
| 36. Deployment | Authorized isolated release PR #29; final deployment evidence recorded there |
| 37. Runtime | Local/CI validation above; post-deployment checks recorded in PR #29, not inferred from unit tests |
| 38. Known limitations | Unidentified historical applications, sparse mappings, async reconciliation repair, CI/live QA pending |
