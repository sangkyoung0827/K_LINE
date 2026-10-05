# Google Forms + WooHyukmon 5.0: Parallel Development

## Release Gate

Status: **DEVELOPMENT / REAL GOOGLE VALIDATION PENDING**. This is not `GOOGLE_FORMS_CUTOVER_READY`.

Production merge, deployment, public Google Forms, live ECC notices and native application cutover remain unauthorized. On 2026-10-05 the user authorized reuse of an existing project within the free tier: the additive, prefixed test migration below was applied to K_LINE. No existing production tables or member records were modified. Native ECC, SIU, Jeju and Hanhwal applications remain the default. No 410, redirect or replacement was introduced.

## Audit

- Base: main `5b154f3c1913c7393bba9fc2ab7e43bf83bd13bb`.
- PR #44 foundations reused: OAuth, encryption, templates, Google API, registry/mirror and manager. Native-page changes from that branch were deliberately not imported.
- PR #55/#56 multi-activity fixes remain on main and were not modified.
- ECC current board is `club_board_posts`, read through `/api/club-board-posts?board=ecc`; it is NOT the ECC Alumni notice API. The activity panel's Kakao notices/team output is localStorage/copy-based, not an automatic posting or messaging API.
- WooHyukmon live gateway is `/api/woohyukmon/operations`. The additive Forms handler runs only for registered Forms actions or explicitly Google-Forms-related messages. Existing member/payment/activity operations are unchanged.
- Native confirmation tools reject Forms tool names. Forms approvals use the existing WooHyukmon HMAC signer, a separate namespace, actor binding, draft revision binding and a ten-minute expiry.

## Isolated Environment Setup

Do not change the production Vercel environment. Set these only on a separate local/test deployment:

```dotenv
GOOGLE_FORMS_AUTOMATION_ENABLED=true
GOOGLE_FORMS_ENVIRONMENT=test
GOOGLE_FORMS_TEST_ORIGIN=http://localhost:3300
GOOGLE_FORMS_CLIENT_ID=<test Google OAuth client>
GOOGLE_FORMS_CLIENT_SECRET=<server-only test secret>
GOOGLE_TOKEN_ENCRYPTION_KEY=<random secret of at least 32 characters>
GOOGLE_FORMS_TEST_SUPABASE_URL=<isolated test Supabase project>
GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY=<server-only test service key>
AUTH_SECRET=<existing server-only signing secret>
```

Forms storage uses its OWN test URL/key, not the normal K_LINE Supabase client. Without a prefix it refuses the production project and a test URL equal to the normal Supabase URL. With exactly `GOOGLE_FORMS_TEST_TABLE_PREFIX=kline_forms_test_`, it can use the existing project but rewrites every allowlisted table request to that namespace, including notices and member matching. Unknown tables, RPC paths and arbitrary prefixes are rejected. It still refuses `VERCEL_ENV=production`. Normal K_LINE authentication/club authorization still determines access; no authentication bypass is introduced.

### Existing-project test namespace (approved 2026-10-05)

Use `GOOGLE_FORMS_TEST_TABLE_PREFIX=kline_forms_test_` together with the existing project's test URL and server-only key. Never enable this on the production deployment. Apply only `supabase/migrations/20261005092720_google_forms_shared_project_test.sql`, NOT the unprefixed foundation files. This creates eight prefixed test tables, including dummy-only member matching and private test notices. No original board or member table is used by the Forms store.

Applied and verified in K_LINE: eight tables, RLS enabled, anon/authenticated SELECT denied, service-role writes allowed. No paid project, branch, upgrade, or production environment change was performed. Actual Google OAuth/client grant and end-to-end Google response validation remain pending. The Google Cloud OAuth brand was created; the client credential creation screen is handed to the user for its final action.

Validation on 2026-10-05: 18 Forms/SQL tests, typecheck and build passed. Local automated Playwright launch was blocked by macOS Mach-port sandbox permissions; it is not reported as passing. Manual in-app browser checks passed for draft/edit/approval and applicant mirror using the explicitly labeled mock-only fixture. At 390px, scroll width was 390px and no console errors were recorded. The advisor reports RLS-without-policy informational notices for these server-only tables; this deny-by-default configuration is intentional, with browser-role privileges revoked.

After explicit user approval for external authentication, enable Forms API and Drive API for the test Google Cloud project; register the exact redirect URI `<GOOGLE_FORMS_TEST_ORIGIN>/api/google-forms/oauth/callback`; add the dedicated Google account as an OAuth test user. Visit `/admin/google-forms` as an authorized administrator and connect that account. Required scopes are Forms body, Forms responses read-only, Drive file, openid/email. Refresh tokens are AES-256-GCM encrypted; OAuth state is signed, cookie-bound and actor-bound. No token is returned to the UI.

No real Google grant was performed during development. Do not paste secrets into chat, tickets, client code, screenshots or commits.

## SQL

For a fresh isolated TEST DB only (not the approved shared-project namespace), run in order:

1. `supabase/google_forms_application_migration.sql`
2. `supabase/google_forms_workflows.sql`

All six new tables enable RLS and deny direct public/anon/authenticated access. Only the service role has table privileges. The local PGlite test executes both files twice and tests denied anon reads and separate activity instances. It removes the `CREATE EXTENSION pgcrypto` statement because PGlite already provides `gen_random_uuid`; installing that extension on real Supabase is NOT covered by this local test.

If a test database already ran the old PR #44 migration, its old activity-type uniqueness index must be reviewed before reuse. This branch changes the NEW foundation's index to instance-level uniqueness, but does not automatically drop a pre-existing index. Use a fresh test project; do not alter production to resolve this.

The ECC notice adapter expects the existing `club_board_posts` schema in the isolated DB. Set up that schema there using dummy data only; do not run the entire legacy SQL against production. Member matching uses only the test database's dummy `site_members` table; lookup failure means an unmatched respondent, never a role mutation.

## Flow and Recovery

1. Natural Korean/English command or manual builder creates a stored draft and bilingual notice preview.
2. Ambiguous relative dates, absent times/title/location/deadline request clarification. The parser intentionally does not guess dates or invent event details; arbitrary conversational extraction is limited and the manual editor is the fallback.
3. Administrators edit title/date/location/questions/options/order/required flags and notice, then save. This changes the revision and invalidates old approval tokens.
4. Approval reserves a workflow using a compare-and-set status/revision update. Google creation explicitly uses `unpublished=true`.
5. Creation reserves an idempotency key and immutable draft hash BEFORE calling Google. The remote form ID is saved immediately; stable item/question IDs make setup retryable. No incomplete form is automatically deleted.
6. Only Google's actual validated `responderUri` enters the notice. A missing URI stops processing; no fabricated response link is used.
7. The same ECC board adapter saves a PRIVATE draft in the TEST DB with workflow UUID as notice UUID. An independent read verifies that draft was saved. Public posting is explicitly blocked.
8. Notice failure preserves the registry and remote form. Obtain a fresh preview and approve retry: it reuses that form and notice UUID.

Unknown external create outcome (timeout before receiving the form ID) is marked `uncertain` and stops retries. This prevents duplicate creation but requires authorized reconciliation against the test account's Drive. A process crash leaving `running` similarly requires review; there is no unsafe lease-expiry auto-create. Do not change the draft or generate a new idempotency key to work around either condition.

## Actions

The registry and gateway expose draft/preview/update/create/get, response sync/count/summary, notice generate/preview/update, combined create-with-notice and recruitment open/close approvals. `CREATE_GOOGLE_FORM` prepares the approved combined workflow rather than silently mutating on the first request. `PUBLISH_ACTIVITY_NOTICE` has an actor/revision-bound approval and a verified board write, but refuses publication unless `GOOGLE_FORMS_TEST_NOTICE_PUBLICATION_APPROVED=true` is separately approved and set in the isolated test environment. This flag was NOT set and public notices were NOT posted. SIU/Jeju form foundations exist, but their notice adapters are explicitly pending; no SIU/Jeju native changes were made.

Recruitment publication requires the additional server flag `GOOGLE_FORMS_TEST_PUBLICATION_APPROVED=true`, ONLY after separate permission to publish a test form. This flag is not set by the code or this task. Draft/archived forms are unpublished; open forms accept responses; closed forms are published but do not accept responses. Each operation targets exactly one registry ID. Passed deadlines prevent reopening.

## Response Mirror and Teams

Question IDs, item IDs, title snapshots, multichoice values, missing/deleted question indicators and file metadata are preserved. Duplicate titles do not overwrite each other. Responses are deduplicated by registry ID + Google response ID; all Google pages are read with a repeated-token/maximum-page guard. A failed partial sync does not set a successful last-sync timestamp or final count; retry upserts safely. Existing records are not deleted when Google response counts shrink.

The manager keeps the Google roster separate from native applications. It shows count, submission time, email and answers, and provides a source-separated snake-allocation preview and name-copy export to the existing native ECC team-maker input. It does not automatically persist Google groups into native records or infer native attendance/history. Groups have no invented prior-activity scores. Advanced native history-weighted team linkage remains pending approval/design.

## Scheduling

`GET /api/google-forms/maintenance` has a constant-time bearer check against a server-only `GOOGLE_FORMS_TEST_CRON_SECRET` of at least 32 characters and the test-environment/storage gates. It processes up to 20 oldest-synced open/closed forms, closes expired forms, and isolates sync failures per form. No scheduler or `vercel.json` cron was installed.

Vercel Hobby supports daily invocation with hour-level precision; Pro/Enterprise permit minute-level intervals. Cron functions incur normal function usage. Confirm the actual plan, costs, authorization and timing requirements before installing a test scheduler. A daily Hobby cron is not a precise deadline enforcement guarantee. Source: https://vercel.com/docs/cron-jobs/usage-and-pricing

## Verification

The manager's Google Forms tab now accepts only an existing template and activity title. The preset is built server-side from existing questions and descriptions, then the same actor-bound workflow creates the private test form and notice with its returned responder URL at the bottom. Unknown dates, deadlines and locations are omitted, not invented. The notice can be copied; failures retain the pending workflow for safe retry. The local fixture also uses the real preset/notice functions, but its Google URL and storage remain mocks. Actual OAuth creation remains unverified; no production deployment is authorized by this UI change.

- `npm run test:google-forms`: actual module execution against mocked Google/storage + isolated PGlite, not real Google.
- `npm run typecheck` and `npm run build`: passed during development; re-run after final edits.
- Native regression suites in `npm test` passed through the pretest stage. Local full check hits the existing traditional-liquor Chromium launch test and fails under macOS sandbox (`SIGABRT` / Mach launch permission), not an ECC application assertion. The browser is not silently skipped.
- Separate Browser Safety CI must pass before any merge. A new parallel-development CI job runs the Forms mocks/SQL plus real Playwright desktop/mobile UI tests.
- Local in-app browser UI fixture: real manager components, mocked backend only. Verified natural-command clarification, manual preview, notice edit/save, approval completion, applicant mirror, multi-answer rendering and 390px layout with no horizontal overflow. This does NOT prove OAuth, a real Google response or production notice delivery.
- No `lint` package script exists. Next build's existing lint/type stage and the repository checks are used; no fake lint success is reported.

Official Google API references checked: https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create and https://developers.google.com/workspace/forms/api/reference/rest/v1/forms

## Remaining Gates

OAuth verification completed on 2026-10-05 for `waterfallingsound0827@gmail.com`: exact account/email verification, all three API scopes and a real refresh-token exchange succeeded. The AES-GCM encrypted connection was installed into `kline_forms_test_google_oauth_connections` and its account/scopes were confirmed by the database response. Encryption key and client secret remain local and untracked. This is NOT a completed Next.js form-creation E2E test or a production deployment; the local application still needs its server-only database credential and matching encryption-key configuration. The 3317 UI fixture remains mocked.

Local OAuth bootstrap: `node scripts/google-forms-oauth-local.mjs <downloaded-client-json>`. This loopback-only tool verifies the dedicated project/redirect, cookie-bound expiring state, PKCE, exact account, granted scopes and offline token refresh. It uses the existing AES-GCM helper and ignores both local key/connection files in Git. It does not bypass application authentication or write production data. On 2026-10-05 the account owner approved Forms body, response-read and Drive-file access plus encrypted storage in the prefixed test table. The account was added as the only test user. The Google unverified-app warning is awaiting the user's own continuation; no refresh token or completed connection has been confirmed yet. Vercel's sensitive service-role variable cannot be decrypted via the connector; normal Next.js end-to-end storage integration remains a separate unresolved local configuration gate.

- Explicit approval for test-account OAuth and isolated-test-DB setup.
- Real create/edit/responder URL and real respondent submission.
- Real sync with all question types, reopen/close and Google Workspace responder restrictions.
- Full test-account command-to-private-notice-to-roster flow, including API latency/quota limits.
- Crash/unknown-create reconciliation UI and production-scale batching/pagination of the manager mirror.
- Real publication-adapter validation after separate approval, non-ECC adapters and any native history-weighted roster integration.
- User review of PR, real test evidence, regression CI, privacy/security review.
- Separate future approval for production schema/merge/deploy, and a DIFFERENT separate approval for native cutover.

None of these gates is satisfied merely because mock tests or a build pass.
