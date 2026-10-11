# Event Archive Ingestion Protocol

Status: server endpoints and local transport tests implemented; no ChatGPT
connector has been installed or remotely verified.

## Authentication

Browser: existing NextAuth session. Mutation requests require a same-origin
`Origin` header. Never accept a client-supplied identity or role.

External client: an authorized operator explicitly requests a temporary token:

```http
POST /api/event-archive/connector
Content-Type: application/json
Origin: https://kline-nine-wheat.vercel.app

{"clubKey":"ecc","confirmed":true}
```

The response includes `token` and `expiresIn`. The bearer expires in
15 minutes, is limited to one club and is checked against current server roles on
every request. Revoked or read-only roles cannot continue. Keep it secret and do
not place it in URLs, source code, localStorage, public logs or notices.
This is not an OAuth implementation or a registered ChatGPT Action.

## Prepare

```http
POST /api/event-archive/ingest
Authorization: Bearer <temporary scoped token>
Content-Type: application/json

{
  "clubKey":"ecc",
  "idempotencyKey":"a-new-stable-request-key-0001",
  "texts":["  exact original notice\r\n\r\n  "],
  "files":[
    {"name":"poster.png","mimeType":"image/png","size":12345,"sha256":"<64 lowercase hex characters>"}
  ],
  "sourceKind":"connector",
  "sourceIdentifier":"<source reference without credentials>",
  "upstreamFormatting":"unknown",
  "aiConsent":false
}
```

The example file size and hash are placeholders, not a successful upload.
Compute SHA-256 over the exact original bytes. Do not normalize text, convert
images, correct spelling or replace originals with AI extraction.
Use one text entry per notice. A combined free-form paste is retained as one
original, not automatically split into independently verified event records.

Limits: 20 input entries, 25 MiB per file, 100 MiB total binary size, 500,000
text characters total, 200,000 per text, 2.2 MB JSON request body.
Supported original files: PNG/JPG/JPEG/WEBP/GIF/PDF/DOCX/PPTX/TXT/MD.
TXT/MD require valid UTF-8. NUL/unpaired surrogate text is rejected, not repaired.

Response: `batch_id`, state, results and signed upload URLs with file indexes.
Preparation is not a saved receipt.

## Upload And Verify

Upload the corresponding bytes directly to each returned `signedUrl` with
`PUT`, the declared Content-Type and `x-upsert: false`. Never send a multi-MB
binary body through the Next.js JSON endpoint.

Then:

```json
{"action":"finalize","batchId":"<returned UUID>"}
```

Send that JSON to the same ingestion endpoint with the same authentication.
Only verified items receive `original_preserved:true`, their original hashes
and an archive link. Status `partial` is not full success.
Each receipt states new verification or, for a resumed durable success,
`verification:"previously_verified"`.

For recovery:

```json
{"action":"status","batchId":"<UUID>"}
```

This returns per-input results and fresh signed URLs for unfinished files.
Re-upload the same original bytes if missing and repeat finalize. Reusing the
same idempotency key with another manifest returns a conflict.
`IMPORT_BUSY` means wait for the active lease; expired leases can be reclaimed.
`IMPORT_CONTINUE_REQUIRED` means finalize the same batch again, never create
a new batch merely to bypass a timeout.

`{"action":"pending"}` returns the ten most recent unfinished batches owned
by the current operator within their currently authorized clubs. Import Center
uses this after a refresh; originals and connector tokens are not persisted in
browser storage. The status response includes original file descriptors to
verify reselected files before retrying uploads. Recovery does not silently
restart AI classification or change publication/analysis consent.

Explicit temporary-object cleanup:

```json
{"action":"cleanup","batchId":"<UUID>","confirmed":true}
```

Cleanup is owner-scoped, mutually exclusive with finalization and only removes
unreferenced temporary paths of that batch. It never deletes archive records,
referenced originals or legacy files.

## Classification And Publication

`POST /api/event-archive` supports `classify`, `labels`, `review` and
`version` actions. `GET` supports scoped lists, `?id=<UUID>` and
`?id=<UUID>&asset=<UUID>` (60-second download URL).

AI classification requires separate consent to sending the selected original
to OpenAI. Saving does not require an AI connection. Generated labels require
human review and never change owning scope. PPTX currently requires manual
labeling; original storage/download is supported.

Publication requires explicit privacy, copyright and source checks. AI analysis,
AI reference permission and public visibility are distinct settings.
No auto-publication, automatic ChatGPT message scraping or automatic legacy
deletion exists.

## Client Integration Gate

A future ChatGPT/Work connector must use its supported authenticated file
transfer, receive an explicit user request and pass a real end-to-end upload
against approved infrastructure. Browser paste and drag/drop are the currently
implemented fallback. The same server protocol is reusable by the mobile app,
but a native authenticated client has not been wired or tested in this change.
