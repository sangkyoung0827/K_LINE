# OpenAI Club Operations Assistant

## Scope

- General KLINE conversation, Solbam and Jeju assistant share OpenAI Responses generation. There is no Gemini/NVIDIA fallback.
- Credential priority: WOOHYUKMON_OPENAI_API_KEY, EVENT_AI_OPENAI_API_KEY, OPENAI_API_KEY. Keys remain server-only; no new key or provider permission is created.
- General default model: gpt-6-luna. Existing event planning retains gpt-6-luna/gpt-6.1-sol complexity routing.
- Each request resolves existing ECC, HANHWAL, Social Impact Union, Jeju, research-editor and developer archive permissions independently. A failed lookup grants nothing.
- Ordinary members retain activity guidance, not administrator tools. Read-only developer write restrictions remain in place; the interactive launcher is hidden for that account.
- A closed business-route registry invokes existing API handlers in the authenticated request context. It does not expose arbitrary URLs, SQL, source code, secrets, files on the server, deployments or operating-system commands.

## Operations

- Query registrations, fee status, roles, activities, applicants, settings, notices, research and developer archive data within existing permissions.
- Prepare edits, approvals, activity state changes and other supported JSON operations, then require an explicit signed confirmation. Native endpoints retain their own admin/super-admin, ownership, validation and workflow requirements.
- Receipt uniqueness prevents approval replay. Stale source data, expired approvals, account changes and revoked grants reject execution.
- XLSX and DOCX downloads reauthorize the actor and source at download time; URLs expire after ten minutes. No document content is stored in the confirmation token or publicly published.
- ECC/HANHWAL member exports use paginated source reads. XLSX rosters keep student ID/name as literal strings and retain the existing student-ID ordering.
- Contact identifiers and credentials are omitted from AI retrieval context. Archive text without AI consent is not forwarded. Non-developer general chat no longer retrieves developer training chunks.

## Deliberate Boundaries

This is a controlled business assistant, not an unrestricted ChatGPT computer agent. Only registered routes and methods execute. Original file uploads, Google OAuth consent, and final Google Form creation retain their existing dedicated screens/workflows. The assistant can prepare event plans; it does not bypass original review or grant new club creation capabilities unsupported by current KLINE adapters. Model decisions never count as consent or authorization.

## Database

One additive server-only table: woohyukmon_club_action_receipts. It stores actor, scope, capability, status and a one-way token identifier, not member records or generated files. RLS is enabled; anon/authenticated privileges are revoked. Existing club tables, original files and payment/approval logic are unchanged.

## Verification

- New isolated PostgreSQL/route/authorization/export tests and OpenAI-only generation tests.
- Fresh real OpenAI planning with isolated business fixtures: eight cases, no production writes and no Google Forms created.
- Existing regression suite attempted locally; its Chromium-dependent test cannot launch under the desktop filesystem/process sandbox. Browser Safety CI must pass before merge.
- Production build, type checking and V4 bundle isolation are checked separately.
- Browser QA uses a clearly labelled loopback-only fixture server; it never connects to production DB. Browser download completion is not used as evidence when the browser runtime cannot return it.

## Reproduction

- npm run test:club-assistant
- npm run test:woohyukmon
- npm run check
- node scripts/woohyukmon-club-preview.mjs (loopback QA only)
- node scripts/woohyukmon-club-live-qa.mjs (existing approved local key; mock business routes and local receipts)

Do not commit secrets or turn QA role fixtures into production authentication. The full deployed release and post-deploy API probe are recorded separately after CI and deployment complete.
