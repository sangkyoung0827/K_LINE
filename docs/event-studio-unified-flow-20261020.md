# Event Studio Unified Creation

## User-Visible Flow

- The composer defaults to creating an announcement and a private Google Form.
  A checkbox allows announcement-only work without Google mutations.
- The same composer collects missing facts. Once complete, the explicitly
  requested operation continues through review and form creation automatically.
- A disconnected personal Google account pauses at a clear connection action.
  OAuth returns to the same saved event instead of an empty workspace.
- Only an unexpired, same-browser creation intent for the exact job/revision
  resumes creation after OAuth. Browsing or reloading saved jobs never does.
- The completed screen contains the original form, announcement and separate
  application link. An incomplete draft no longer shows an empty link field.
- Progress uses one short line; the separate renew-approval action is removed.

## Safety

The server still requires a signed actor/job/revision/content-bound approval.
Fresh review refuses changed revisions. Missing information and unsupported
adapters cannot create. Running/uncertain attempts never retry blindly. Existing
job idempotency and owner-scoped Google credentials are unchanged. Recruitment
remains closed and the notice remains private. No schema migration is needed.

OAuth checks ownership before signing the return job. Identity, nonce, expiry
and replay checks remain. Cancelling OAuth preserves the job and does not create.
Browser storage contains only job ID, revision and a ten-minute expiry, not event
content, tokens or credentials. If storage is unavailable, completion is manual.

## Verification Boundaries

Unit tests cover automatic completion, missing facts, disconnected Google,
changed revisions, running work, provider failure and expired/mismatched intent.
OAuth integration tests use an isolated database and fake provider responses.
UI tests cover initial single-submit completion, follow-up completion, personal
connection round-trip, reload without duplicate creation, separate link output,
desktop/mobile overflow and existing applicant/deletion behavior.

The owner approved production release after verification on 20 October 2026.
No actual OpenAI response or Google Form was generated during this change;
fixture output proves workflow behavior, not live writing quality or Google health.
