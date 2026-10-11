# Event Studio Archive — Implementation Contract

Status (2026-10-12): **IMPLEMENTED LOCALLY / REMOTE VALIDATION PENDING**.
The existing home card is retained. The hub now contains AI Creator, Event Archive
and Import Center. Original-preserving APIs, an additive migration and local
PostgreSQL/filesystem verification are implemented. No production migration,
deployment, real OpenAI classification, native-app integration or installed
ChatGPT connector is claimed. See `EVENT_ARCHIVE_VALIDATION.md` for the evidence
and remaining gates, and `EVENT_ARCHIVE_CONNECTOR.md` for explicit ingestion.

## Goal
Unify ECC, Hanhwal and Social Impact Union activity notices, original posters, supporting materials, generated Google Forms and source-grounded WooHyukmon event drafting. Preserve original content *exactly*, including Unicode grapheme sequences and emojis.

## Storage
- Additive, private Supabase tables for `event_archive_items`, `event_archive_assets`, labeling suggestions, and import/audit jobs; link existing Event Studio jobs, forms and notices by stable identifiers.
- Store original UTF-8 notice text **unaltered** in `original_text`. Never overwrite it when generating titles, English/Korean translations, summaries, extracted dates or corrected text. Preserve original whitespace, linebreaks, punctuation, typos, spacing, emoji and Unicode characters as the ingestion API receives them. For byte-exact preservation of supplied text *files*, store the original file bytes in private Storage as well.
- Use a private `event-assets` Storage bucket for original posters and attachments (not image Data URLs in database). Store SHA-256, MIME type, size, original filename, immutable object path; produce separate previews/thumbnails. Originals remain downloadable to authorized users. Do not compress/re-encode originals.
- Label fields are separate: `club_key`, `event_type`, `title_suggestion`, `year`, `event_date`, `language`, `tags`, `confidence`, `review_state`, `source_kind`. Unknown inferred values stay unknown. Tagging **must never change original content**.
- Default visibility PRIVATE pending owner review. Never auto-publish, disclose member personal data, or index private records in public AI search.
- Do not migrate/delete legacy ECC data, LocalStorage, existing board posts, Google Forms or registration data automatically; use explicit opt-in import/export with backup and dry-run.

## Archive UX
- Keep AI event creator operational; add separate Archive tab with searchable poster/notices cards, filters by club/type/academic term/date, original-preserving viewer, file download, inferred-tag editor, original vs AI-derived text tabs, history and duplicates detection.
- Restricted writer roles: authorized club managers and global admins; segregate read/write across organizations. Owning scope is immutable. Suggested organization edits never transfer access. Unknown-scope records remain private pending global review; a cross-scope curator transfer UI is not implemented.
- Link archive records to event plans, finalized notices and actual Google Forms URL only after verifiable IDs exist.
- Archive > Reuse prompts the AI to draft a NEW event from authorized historical references. Explicitly never reuse historical dates, fees, venues, application links, eligibility or penalties as current facts.

## ChatGPT conversation ingestion: critical limit
This chat does **not** automatically send every subsequent user message or attachment to K_LINE. Build an authenticated ingestion bridge/workflow; do NOT claim live automatic archival without it.
- Input can be pasted text, uploaded PDFs/DOCX/TXT, original posters or attached pictures. One mixed message may produce multiple related archive items.
- Option A: upload through an authenticated Event Studio UI.
- Option B: a connected ChatGPT Work or purpose-built connector calls `POST /api/event-archive/ingest` after receiving attachments, with explicit authorization. Only the connector can access transferred bytes; do not try to retrieve private ChatGPT messages from a public endpoint.
- Require owner-authenticated token/session, origin/CSRF checks as appropriate, rate limits, file and content type validation, 25 MB default file limit, idempotency key and upload audit receipt.
- Return verified `archive_id`, original text hash, uploaded file hash/path, suggested tags, saved state and source-of-truth permalink.
- Never silently assert upload success if K_LINE API or Storage did not confirm saving. Pending or blocked uploads must be explicit.
- The user requests no confirmation for every tag; auto-suggest tags, but keep imported records PRIVATE until reviewed. Do not require manual classification of every item.

## Tests
Emoji and composed Unicode round-trip, CRLF/LF text attachment preservation, unusual whitespace, mixed bilingual notices, multiple files in one request, mime mismatch, oversized file, exact-original SHA, duplicate retry, cross-club permission denial, expired token, interrupted storage upload and rollback, restricted archive search, malicious embedded instructions, incorrect inferred event dates, draft/notice/form linkage, backward compatibility.

## Milestones
1. Card + authenticated hub (this draft PR).
2. Migrations, private Storage bucket, archive API and tested archive UI.
3. AI tagging (derived metadata only), event-linking and revisions.
4. External ingest connector + end-to-end ChatGPT-origin upload verification.
5. Staged tests, backups, owner approval, then deploy.

No production deployment or production data changes were performed. Applying the
new migration requires a verified backup, review and explicit owner approval.
