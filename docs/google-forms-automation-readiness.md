# Google Forms Automation Readiness

## Scope

New Event Studio jobs store `ai_metadata.formDraftVersion=2`. Their Google description
contains the approved bilingual date, deadline, venue and capacity. Time-bearing values
display in KST with the timezone named; date-only values remain date-only. New jobs with
a date-only deadline ask for its time/timezone before approval. Legacy jobs retain v1
descriptions, metadata and idempotency hashes; existing originals are not rewritten.

Only forms with `metadata.automation={version:1,capacity:<positive integer>}` opt in.
Native ECC/HANHWAL/SIU/Jeju applications and memberships are not read or modified.
No form or public notice is published automatically. The existing production publication
guard remains in effect.

## Capacity Semantics

The Google Forms API has no native numeric response-cap setting. Polling cannot prevent
all simultaneous/late submissions through a direct Google respondent link. This feature
is therefore **capacity-based closure plus an explicit waitlist**, not a hard reservation
system. The generated description discloses the waitlist rule. Do not advertise a strict
submission cap. A hard cap would require a separately approved admission/reservation flow.

Current complete responses are ordered by Google createTime, then response ID as a stable
tie-breaker. On-time first N responses form the roster; excess and late responses are
listed separately and excluded from team generation/copy. This is a response count,
not unique-person verification: repeated submissions are not silently merged by name.
Backfilled/deleted Google responses can change the next synchronized ranking; the roster
is not a permanent acceptance ledger or a participant notification system.

New automated forms commit each response snapshot transactionally under a form-row lock.
An older overlapping sync cannot overwrite a newer snapshot. Historical mirrored rows
are retained but excluded from the current automated roster. Partial Google reads cannot
commit partial counts. Legacy sync behavior is preserved.

## Worker and Recovery

`GET /api/google-forms/maintenance` accepts a server-only bearer secret for operator checks,
or a SHA-256 HMAC signature over `google-forms-maintenance\n<unix-seconds>` for scheduling.
Signatures expire after 90 seconds (15 seconds of future clock skew allowed); altered or
expired signatures fail. Leases and retry delays make brief signed-request replays
idempotent per form. Scheduled replies contain only an `ok` boolean, never form IDs,
applicant counts or answers. The shared signing secret is
`GOOGLE_FORMS_CRON_SECRET` (32+ characters; the old test-only name remains a fallback).
Leased DB jobs claim at most three forms; lease TTL is ten minutes. A crashed worker can
be reclaimed. Completion is bound to the same unexpired lease. Success/failure and next
attempt are durable; failures return HTTP 503, not a misleading success. Retry interval
is five minutes. The scheduler should invoke once per minute, so larger backlogs take
longer than five minutes. No exact-second closure guarantee is made.

Overdue closure runs before response download; capacity closure after successful sync.
The close helper reads actual Google publication state and only disables accepting
responses, never turns an unpublished original into a published one. Closed forms sync
for seven days after the deadline (or creation when no deadline exists); later manual
sync remains available. A Google outage/token revocation can delay closure and sync.

## Database and Release

Additive migrations:
- `20261018090607_google_forms_maintenance.sql`: server-only leases, claim/finish RPCs and atomic snapshots.
- `20261018091100_google_forms_scheduler.sql`: existing-project pg_cron/pg_net integration and a fixed-origin dispatcher.
- `20261018092012_google_forms_scheduler_queue_privacy.sql`: best-effort pg_net ACL hardening. Managed supabase_admin ownership can leave PUBLIC grants in place; do not rely on this REVOKE as a security boundary.
- `20261018092152_google_forms_scheduler_signed_dispatch.sql`: **required** replacement dispatcher; sends only expiring HMAC signatures, never a Vault secret/bearer token through the pg_net queue.

RLS is enabled; anon/authenticated cannot access the maintenance table or execute RPCs.
Only the named new RPCs are added to the existing Forms store allowlist. No untrusted
URL, SQL or native-table access is accepted by the worker.

Activation order, deliberately not automatic in migrations:
1. Pass full repository checks and Browser Safety CI; review and deploy the new endpoint.
2. Confirm the final signed-dispatch migration is applied. Generate a dedicated random maintenance secret. Store it in Vercel Production as
   sensitive `GOOGLE_FORMS_CRON_SECRET` and Supabase Vault as `kline_forms_maintenance_token`.
   Never reuse Google/API/database credentials or place a secret in SQL source/logs.
3. Redeploy; verify unauthenticated rejection and an authenticated no-op against the
   new deployment without changing any existing form.
4. Register the named job once (same name replaces an existing schedule):

```sql
select cron.schedule('kline-forms-maintenance', '* * * * *',
  'select public.kline_forms_live_dispatch_maintenance()');
```

5. Check cron job run details **and pg_net HTTP status**; successful SQL dispatch alone
   is not proof the remote worker succeeded. Check per-form last_success_at/last_error
   when eligible forms exist. Do not enable or rewrite legacy forms for this check.

Rollback: unschedule only this named cron job, retain all tables/data and restore the
previous code if needed. Never disable RLS or broaden Google scopes to repair a worker.

## OAuth and Account Verification

The connection status now attempts refresh: invalid_grant shows reconnect_required;
transient failures show unavailable, without exposing tokens. A saved row is not treated
as proof of a healthy connection. This is detection, not a workaround for Google's
External/Testing seven-day refresh-token policy.

The Google console still needs completed branding, an approved public privacy policy,
scope review and any required domain/brand/sensitive-scope verification. The separate
privacy draft is NOT published or submitted. Google production transition needs operator
confirmation and a fresh connection afterwards; do not promise a token never expires.

Anonymous/member/other-club/read-only authorization is covered by isolated API tests.
Actual signed-in ordinary-member/other-club/read-only account checks require those real
sessions; do not manufacture sessions or change a member's production role for testing.

References: [Google Form settings](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#FormSettings),
[Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions),
[Vercel Hobby cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
