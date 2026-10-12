# Event Studio 2.0 Validation And Release Gates

Date: 2026-10-12 (Asia/Seoul). Branch:
`feat/event-studio-archive-entry-20261011`, existing review PR #67.
No production schema write, legacy migration, deployment or real AI call.

The preceding statement and the development-only evidence below describe the
initial validation checkpoint. The subsequently approved real PALBOK import
applied the additive archive migration and verified hosted Storage, database and
OpenAI calls. See [the registration report](PALBOK_ARCHIVE_REGISTRATION_20261012.md)
and [the per-original receipt](receipts/palbok-20261017-import.json).
No website deployment or PR merge was performed at either checkpoint.

## Implementation

- Existing home card retained, no duplicate card.
- Hub: existing AI Creator, scoped Event Archive, Import Center.
- Exact UTF-8 text and binary originals, SHA-256 verification, immutable triggers,
  separate labels/versions, scoped hash deduplication and batch/event links.
- Signed direct uploads, private signed downloads, persisted partial receipts,
  leases, stale-worker rejection and explicit unreferenced-object cleanup.
- Owner-scoped pending-batch discovery and refresh recovery with original-file
  hash matching; no original text/token saved in browser storage.
- Manual review/visibility and separate AI analysis/reference consent.
- Structured OpenAI label call reuses event-AI server configuration and the
  existing Luna/Sol choices. Independent archive quotas do not write legacy
  Forms usage tables. No automatic provider fallback.
- Selected approved archive references feed existing event planning as historical
  data; URLs and basic identifiers are removed from the prompt. Original sources
  remain unchanged. Their IDs are recorded in job metadata and archive links.
- Legacy read-only preview and explicitly approved copy; browser-only notice
  export. No automatic movement/deletion.

## New Database Objects

Review-only migration:
`supabase/migrations/20261011073509_event_archive_v2.sql`.

Tables:
`event_archive_items`, `event_archive_assets`, `event_archive_labels`,
`event_archive_import_jobs`, `event_archive_links`, `event_archive_versions`.

Private bucket: `event-assets`.
Original object paths: `club/batch_uuid/index-sha256.extension`.
Identical bytes may share a blob within the same club, while filename metadata
and import relations remain separate. Cross-club blob access is not shared.

All six tables enable RLS and deny direct browser grants. Server NextAuth roles,
not user-editable Supabase claims, decide scope before service-role access.
The new bucket adds restrictive browser policies without opening existing
buckets. No DELETE grants on archive tables.

## APIs

- `GET/POST /api/event-archive`
- `POST /api/event-archive/ingest`
- `POST /api/event-archive/connector`
- `GET/POST /api/event-archive/legacy`

See `EVENT_ARCHIVE_CONNECTOR.md` for request, authentication and recovery rules.

## Read-Only Legacy Audit

On the existing production project `okcabiimxuhhhokqajjg`:

| Source | Records |
| --- | ---: |
| ecc_resource_files | 13 |
| club_board_posts | 0 |
| hanhwal_board_posts | 0 |
| kline_forms_live_google_form_workflows | 2 |
| kline_forms_live_club_board_posts | 1 |
| kline_forms_live_event_studio_jobs | 0 |

Twelve of thirteen ECC file paths matched Storage metadata. One existing path
needs separate owner investigation. It was not repaired, removed or imported.
This audit is not a backup or proof of binary integrity for legacy files.

## Verification Evidence

- Archive suite: 26 passing Node tests (25 nested cases plus parent).
  Real file-backed PGlite PostgreSQL executes the actual migration and triggers;
  uploads/downloads write/read actual disk bytes. REST/Storage transport,
  identity and OpenAI responses are simulated, not remote Supabase certification.
- Existing Event Studio: 24 tests passed; preserved private Forms approval,
  OAuth failure, retry, quotas, response permissions and native applications.
- Existing pretest regression chain passed after updating the old home-card
  expectation to include PR #67's Event Studio card and three-column grid.
- TypeScript and production build passed.
- Browser metadata, browser safety, Hanhwal isolation, V4 isolation and
  traditional-liquor safety checks passed.
- Full `npm run check` was attempted. It stops at an existing traditional-liquor
  browser test because macOS sandbox denies Chromium's MachPort bootstrap.
  It is **not reported as a full pass**. The new standalone Playwright UI test
  has the same browser-launch restriction.
- In-app browser: exact clipboard equality for emoji/mixed-language/repeated
  spaces/combining Unicode; manual derived-label edits; checklist-gated review;
  original-content search; PNG/PDF multi-upload; PNG download SHA-256 equals
  original; member view excludes private poster/import controls.
- Latest in-app browser recovery check: partial text/file batch rediscovered
  after reload, reselected poster hash matched, final receipt `saved`, no pending
  job remains. Disabled AI attempts do not reserve or exhaust retry quotas.
- Archive tests are included in `pretest`. Browser Safety CI now installs
  Chromium and runs the separate archive UI test. CI has not been dispatched.
- Mobile viewport 390x844: document width 390, original dialog fits viewport;
  Korean and English UI checked. These are browser previews, not physical-device
  tests. Screenshots are local QA artifacts, not production sample data.

The PGlite test adapter reads original text via DB UTF-8 hex because its scalar
decoder consumes a leading BOM. DB hex and original-file bytes both preserve the
BOM; no production text normalization is introduced.

## Changed Files

Existing:
`src/app/event-studio/page.tsx`,
`src/components/google-forms/EventStudio.tsx`,
`src/lib/eventStudio/ai.ts`, `src/lib/eventStudio/service.ts`,
`scripts/social-impact-union.test.mjs`, `package.json`,
`.github/workflows/browser-safety.yml`, `docs/EVENT_STUDIO_ARCHIVE_CONTRACT.md`.

New:
`src/lib/eventArchive/{access,ai,http,integrity,legacy,model,service,store}.ts`,
`src/components/event-archive/EventArchiveWorkspace.tsx`,
`src/app/api/event-archive/route.ts` and `{ingest,connector,legacy}/route.ts`,
the migration above, `scripts/event-archive-harness.mjs`,
`scripts/event-archive-ui-server.mjs`, `scripts/event-archive-ui.test.mjs`,
`scripts/event-archive.test.mjs`,
`scripts/fixtures/event-archive-ui.tsx` and these two documentation files.

## Pending / Not Claimed

1. Actual hosted Supabase upload/download, restrictive signed-URL behavior and
   remote advisors against an approved isolated environment.
2. Real OpenAI labeling quality and actual Google Form creation with historical
   references. No usable local event-AI key was supplied for this verification.
3. Installed ChatGPT connector and actual ChatGPT-origin file transfer.
4. Native WooHyukmon archive screens/auth integration; common APIs exist only.
5. Natural-language autonomous archive retrieval: currently select reviewed
   references in the archive UI before event planning. A combined notice paste
   remains one original; automatic multi-event segmentation is not implemented.
6. Cross-scope curator transfers; PPTX AI extraction; full malware scanning.
   Current signature/ZIP/active-PDF checks are not antivirus certification.
7. Remote legacy-copy exercise and full Browser Safety CI. No tests should be
   skipped or security lowered to hide the local Chromium restriction.
8. Existing Hanhwal/SIU Forms creation adapters remain unimplemented as before;
   this feature does not expand or bypass those production permissions.
9. Search currently uses bounded PostgREST text matching, not a large-scale
   full-text index. Thumbnails use originals; no separate thumbnail files exist.

## Before Production

1. Owner reviews the migration, access policy, AI consent and limitations.
2. Choose an approved isolated Supabase environment. Do not silently create a
   paid project, new account or tables in the production project.
3. Back up legacy schema/records and Storage originals with a restore check.
   No full production backup was performed in this development run.
4. Apply and test the migration only after explicit approval; run remote advisors.
5. Set server-only `EVENT_ARCHIVE_ENABLED=true` and
   `EVENT_ARCHIVE_ENVIRONMENT=test` with isolated
   `EVENT_ARCHIVE_TEST_SUPABASE_URL` / service-role key for staging.
   Test configuration rejects the known production project URL.
6. Run real Storage/AI/legacy/connector/device tests and full CI. Keep originals
   private, avoid disposable fixtures in live data and require reviewed publish.
7. Only after owner release approval use production environment settings and
   deploy. Disabling `EVENT_ARCHIVE_ENABLED` pauses archive APIs; do not drop
   new tables to roll back. Existing ECC applications/resources stay untouched.

The work remains local on the specified branch until review. A remote push may
trigger a preview deployment, so no code push/merge/deploy is performed without
approval of that external effect.
