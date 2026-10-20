# Event Studio: Personal Creator And Hanhwal

## Release State

Review-only change. No production migration, main merge or public release has
been performed for this work. Use the existing studymap4yous-projects/kline
Vercel project and canonical kline-nine-wheat.vercel.app domain for any approved
release. Never create a replacement hosting project.

## User Experience

- Standalone Event Studio no longer has an organization selector or a default
  ECC scope. A signed-in user's new event is a personal event, even when the
  request mentions Hanhwal, ECC or another organization.
- The server still checks existing administrator permissions for contextual
  club creation. Naming a club never grants membership, administrative access,
  private archive references or an operations Google connection.
- The composer contains its submit arrow; refresh and question movement use
  consistent 44px icon controls with accessible names/tooltips.
- Model, revision and AI usage telemetry remain server-side, not in the UI.
- Additional details collapse after required information has been supplied.
- Notices and application links remain separate, independently copyable fields.
- The announcement output controls now support both Korean and English.

## Access And Credential Isolation

- Signed-out visitors see sign-in, not an anonymous creation bypass.
- Ordinary signed-in users can plan personal events and see only their own
  personal jobs. Other users, including superadmins, cannot read those jobs by ID.
- The developer-only Event Archive and Import Center remain developer-only at
  both UI and API entry points. No archive access policies were widened.
- Personal Google consent uses the existing registered callback and scopes. Its
  signed state/cookie includes personal mode, nonce, actor and expiry. Callback
  verifies the current session and the selected Google account's verified email.
- Personal refresh tokens are AES-GCM encrypted, keyed by actor_<SHA256(email)>.
  An AsyncLocalStorage context chooses the connection for each operation. There
  is no fallback to operations credentials, and personal reconnect never changes
  the operations row. No refresh token is sent to the browser.
- New personal forms are private drafts. No automatic recruitment or public
  board posting was enabled. The owner may review the original in Google.
- Response synchronization checks job ownership and uses the same owner's
  Google connection; the response UI receives names and IDs, not original answers.
  Its initial roster is bounded to 1,000 names and shows the actual total when
  additional responses exist; the original Google form remains the full record.
- The existing actor daily limit (default 10 reservations, including retries)
  and shared personal-workspace daily cap (default 50) remain server-enforced.

## Hanhwal Club Adapter

- Authorized Hanhwal administrators can create forms under the hanhwal registry
  key, with private notices under board_id=hanhwal, never ECC.
- Existing idempotency, approval, revision and uncertain-create recovery remain.
- Manager navigation now preserves the Hanhwal scope rather than mapping it to
  ECC; its template entry is a new activity, not an ECC template.
- Social Impact Union's unfinished club publication adapter is not silently
  enabled. Personal proposals can use that theme without operating club records.

## Database Migration

20261020065501_event_studio_personal_and_hanhwal.sql is prepared, NOT applied.
It extends existing Forms namespace check constraints for personal/Hanhwal
records, allows owner-keyed connection IDs, adds a partial owner/update index,
and extends quota reservation to personal events. Both test/live namespace
variants are covered. Existing rows, RLS, revoked browser grants, and
security-invoker function privileges are preserved. No native club tables,
membership, Storage buckets or application data are changed.

## Verification And Limits

- Isolated PGlite + real service handlers cover Hanhwal scope separation,
  ordinary-user personal creation, owner-only jobs, other-user and superadmin
  denial, response-name projection, missing personal connection with no shared
  credential fallback, approval replay/idempotency, encryption and migrations.
- OAuth route tests cover personal start/callback, same-actor binding, cookie
  consumption/replay rejection, wrong Google identity, incomplete scopes,
  read-only denial and operations-row preservation.
- Browser: the actual React component and application services were exercised
  in a loopback-only preview using mocked AI and Google. Hanhwal request ->
  clarification -> explicit test details -> private-form simulation -> separate
  notice/link -> empty response list passed. At 390px, scrollWidth equaled 390px;
  Korean/English controls and desktop layout were checked.
- Mock output is a fixture, NOT a claim about actual OpenAI quality or a real
  Google Form. No real submission or three-account Google login is certified.
- Actual personal OAuth, actual AI output quality and actual Google creation
  still require live verification. Local usable OpenAI credentials were absent;
  private verification deployment and one test form were requested separately.
- Google's app publishing/test-user status must be verified before announcing
  availability to every Google account. Existing testing-mode restrictions and
  7-day token behavior were not changed by this code.
- Hanhwal's existing administrative adapter still uses the controlled operations
  connection; ordinary personal creation cannot use it.
- Automatic recruitment opening/closure for personal forms, account deletion
  integration and self-service token removal are not newly implemented here.

## Local UI Preview

Run node scripts/event-studio-personal-preview.mjs and open
http://127.0.0.1:3364/. It uses an ephemeral database and QA-only mocked
credentials, makes no production requests, and is labeled as a mock preview.
It is never imported by production routes.
