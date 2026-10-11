# PALBOK Actual Archive Registration

Date: 2026-10-12, Asia/Seoul. Repository: sangkyoung0827/K_LINE, PR #67.
This is a real hosted Supabase registration, not a fixture or mock result.

## Result

- Project: `okcabiimxuhhhokqajjg`.
- Bundle: `wellcome-palbok-festival-20261017-chat-20261012`.
- Batch: `dc30119e-5ff9-418f-b203-5fe9578ceaf4`.
- Event: WELL, COME PALBOK FESTIVAL, 2026-10-17.
- Registered: 16 originals, 14 images (13 JPEG, 1 PNG) and 2 UTF-8 notices.
- Registration failures: 0. Downloaded original hashes matched: 16/16.
- Actual OpenAI classifications: 16/16, model `gpt-6-luna`.
- All 16 remain private, pending review; AI classifications require review.
- Source metadata and AI classifications are separate from immutable originals.
- The manifest, CSV, README and contact sheet are not additional archive items.
- All item IDs, asset IDs, filenames, sizes, hashes and object paths are in the
  [registration receipt](receipts/palbok-20261017-import.json).

Input ZIP SHA-256:
`8f9fa50541652f7986a60c47d88c876732d40c1a40de105bc83af4c9a1125a56`.
The ZIP README describes notices reconstructed from visible source messages.
Byte preservation is certified against the supplied ZIP TXT originals, not
against unavailable pre-ZIP chat transport bytes.

## Hosted Verification

The approved additive migration `20261011073509_event_archive_v2.sql` was
applied once after checking that the six archive tables and private bucket did
not already exist. Future runs must reuse and validate existing objects.

- Independent SQL: 16 items, 16 private items, 16 pending-review items,
  16 Storage objects, 16 event links, 16 AI label records and 2 original texts.
- Six tables have RLS enabled; direct anon/authenticated SELECT is revoked.
- Anonymous REST returned 401. Anonymous private/public Storage object requests
  did not return the original. This bucket does not expose a public URL.
- Actual signed downloads were compared with ZIP bytes using SHA-256.
- Both notice database texts, encoded as UTF-8, matched their source hashes.
- Repeating the same import returned the existing batch and 16 existing results,
  with no new upload slots. No duplicate records were created.
- Authorized scoped listing returned 16; a non-admin listing returned 0.
- Original-text search located both notices. Source-provided event grouping
  never changes club access or ownership; records remain unclassified in scope.

Before/after aggregate fingerprints of legacy membership, role, application,
live Forms, notice and Event Studio job data were identical:
`1ce6a1d544b37abb31329d9c5e9c6ad7`.

| Legacy Data | Before And After |
| --- | ---: |
| ECC members / roles / applications | 247 / 249 / 188 |
| HANHWAL members / roles / applications | 2 / 4 / 0 |
| Social Impact Union applications | 0 |
| Live Forms / notices / jobs | 1 / 1 / 0 |

This fingerprint is regression evidence, not a full production backup.
No live notices were posted, Forms created, recruitment opened or legacy records
modified. No new credential or broader user permission was created.

Security advisors reported no new archive WARN/ERROR. Six INFO entries about
RLS without browser policies are intentional deny-all browser access. Existing
unrelated function search-path/security-definer warnings were not modified.

## UI And Automated Verification

- Production TypeScript check and production build passed.
- All 19 existing pretest suites passed; archive suite passes 27 tests.
- Hosted read-only preview uses the actual service, database, Storage and AI
  results; it does not mock identity, transport, objects or query results.
- All 14 real image previews load. Detail views display the original image.
- Original text search, notice copy and download buttons work.
- Browser-downloaded horror notice matches SHA-256
  `bfa7840a6977eb38821217ce8b3240f67f96179778ed92c230382046d7ebe8bb`.
- Browser-copied wine notice matches SHA-256
  `5cefd8a5de85c25d8cc25670c1fe22f551ad118e2c5e5dc8e9c1fe5dde5fa5a7`.
- Mobile 375x812: document width is 375, no horizontal overflow or alert,
  all 14 original images load. This is browser QA, not physical-device testing.
- Earlier full `npm run check` could not finish because a Chromium MachPort
  bootstrap is denied in this macOS sandbox. Full CI is not claimed as passed.

## Access And Handoff

Local read-only operator preview:
`http://127.0.0.1:3357/event-studio?batch=dc30119e-5ff9-418f-b203-5fe9578ceaf4`.
The current in-app browser is authorized by a temporary local capability cookie.
Other browsers intentionally cannot use this link without operator authorization.
The preview listens on loopback only; it is not a deployed website or login bypass.

Intended approved-deployment route:
`/event-studio?batch=dc30119e-5ff9-418f-b203-5fe9578ceaf4`.
The public site's new archive screen is NOT deployed or enabled by this task.
The stored originals are durable in Supabase independently of the local preview.

Operator scripts require an explicit server environment file and an existing
writable super-admin identity. The import additionally requires
`--execute-approved-import`. Re-run only with approval and the same original ZIP;
the stable idempotency key resumes existing records rather than replacing them.
The temporary service-role key file is removed at handoff; no keys or originals
are committed. Restarting the local preview requires fresh approved access.

No PR merge, remote push, preview deployment or production website deployment
was performed. Native mobile archive integration, an installed ChatGPT file
connector, full malware scanning and PPTX AI extraction remain outside this
registration task. AI labels are suggestions and still require human review.
