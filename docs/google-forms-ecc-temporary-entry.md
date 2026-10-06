# ECC Google Forms temporary entry (test only)

## Behavior

- The normal path requires confirmed payment AND official ECC approval.
- Existing strict ECC lookup retries run before a transient outage is reported.
- Only a transient membership lookup failure offers WooHyukmon's payment question.
- A positive self-declaration requests a 15-minute, account-and-form-bound grant.
- A successful negative lookup, authentication/configuration failure, closed activity,
  expired deadline, or Google API failure cannot trigger this exception.
- No membership, payment, approval, or existing ECC route is changed.
- Respondent-only Google permissions are used; editors/owners are not downgraded.
- Broad shared access is rejected. Repeated requests reuse an existing lease without
  extending its expiry. Unverified expiry is never replaced by permanent access.

## Activation prerequisites

This feature is disabled by default and isolated to the existing Forms test store.
It has NOT been deployed or enabled for production.

- `GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED=true`
- `GOOGLE_FORMS_ECC_ENTRY_ORIGIN` points to the authenticated KLINE gate host.
- `GOOGLE_FORMS_NATIVE_EXPIRY_VERIFIED=true` may only be set after a real Google
  respondent permission and post-expiry access test pass on the connected account.
- Existing Google Forms test safety/environment requirements remain mandatory.
- Kakao announcements must use the KLINE entry URL, not a raw Google URL, to show
  the assistant. The Google form itself must use restricted respondent access.

Google's expiration support is account-dependent. A real API test on 2026-10-06
with the approved samgkyoung1004@gmail.com recipient failed with HTTP 403,
`cannotSetExpiration`: "Expiration dates cannot be set on this item."
The newly created disposable form did not receive the temporary permission;
recipient absence was verified and that form was moved to recoverable trash.
See `google-forms-native-expiry-live-20261006.json` for the result.
Mock tests are not proof of Google enforcement. An independently verified
server-side revocation service is required before enabling temporary access in
this environment; a browser timer is insufficient. No verified-expiry flag was set.

## Server-side revocation fallback

The fallback uses a separate additive, service-role-only lease table. A per-form
database lock serializes grant, promotion and revocation operations. It does not
edit existing ECC membership/payment records. A durable pending record is written
before the Google request. Successful grants store their exact permission ID.

Enable `GOOGLE_FORMS_SERVER_REVOCATION_ENABLED=true` only after applying
`supabase/google_forms_ecc_server_revocation_test.sql` and starting a supervised
worker calling `POST /api/google-forms/ecc-entry/revoke` every 30 seconds. Supply
`GOOGLE_FORMS_REVOKER_SECRET` (32+ random characters) to both worker and server.
`scripts/google-forms-revoker-loop.mjs` accepts the exact endpoint in
`GOOGLE_FORMS_REVOKER_URL`; it never follows redirects or logs the secret.
A browser timer or a daily-only scheduler is not sufficient.

The worker scans persistent expired leases, rechecks membership, and removes only
the exact tracked respondent permission. Confirmed official membership promotes
the lease instead. Changed owners/editors are left untouched and flagged for review.
API failures leave the lease for retry on the next run. Missing IDs after ambiguous
Google writes require reconciliation rather than guessing which permission to delete.
The worker stops renewing its heartbeat on failures or unresolved review items;
new temporary grants require a heartbeat less than two minutes old. A worker crash
after a healthy heartbeat can still delay revocation until it restarts. A production
supervisor/monitor is mandatory; exact 15-minute removal is not guaranteed.

The management connector returned an authentication error during initial setup.
After the user logged into Supabase, the additive SQL was executed through the
project SQL Editor. Remote inspection confirmed RLS enabled, anon/authenticated
SELECT denied, and service_role SELECT allowed on all three new test tables.
Per-form locks expire after 30 minutes to recover a crashed operation;
an upstream outage can consequently delay later operations on that form.

A separate live Google API primitive test DID create a disposable unpublished form,
grant samgkyoung1004@gmail.com respondent-only access without native expiration,
verify that exact grant, delete it, and confirm recipient absence. The disposable
form was trashed. See `google-forms-server-revocation-live-20261006.json`.
This proves grant/delete support, not the DB-backed scheduled worker, a 15-minute
elapsed test, or actual access under the respondent's authenticated browser session.

## Integrated verification after SQL execution

`scripts/google-forms-expiry-live-test.mjs --integration` executed the actual grant
and worker modules against the real prefixed test DB and Google APIs. The test
uses a controlled membership lookup outage for only samgkyoung1004@gmail.com and
an accelerated 30-second expiry. Native membership tables are not queried/changed.
It created a disposable unpublished form, removed only its default public
respondent permission, verified restricted access, and temporarily published it.
The lease was persisted as active with the exact Google permission ID. Repeated
worker polls did not revoke before expiry; the subsequent poll revoked exactly one
permission, changed the durable lease to revoked, and verified Google's removal.
Result: revoked=1, promoted=0, retry=0, attention=0. The form was then unpublished,
test-account permission absence checked again, and moved to recoverable trash.

See `google-forms-server-revocation-integrated-20261006.json` for the result.
The Next.js login/self-declaration UI and the respondent's browser identity were
not verified in this run. This was not a full 15-minute elapsed test. No persistent
production scheduler was installed, and neither production deployment nor normal
user gate activation occurred. New Google Forms can contain a default public
responder permission even when unpublished: restrict them before enabling the gate;
the grant helper intentionally rejects broad access instead of silently bypassing.

Full paid-member allowlist synchronization/revocation when approval changes is not
implemented here. Do not describe this test-only gate as complete production dues
enforcement. Previous permanent Google grants can survive later membership changes.

## Verification

47 Google Forms tests pass, including isolated expiry, spoofing, retry, broad-access,
deadline, disabled-feature and confirmed-negative cases. 16 existing ECC approval,
outage-entry and read-only-developer regression tests pass. Typecheck and build pass.
Mobile (390px) simulation confirmed question/negative-answer/payment guidance with
no horizontal overflow; confirmed-unpaid state has no bypass question. The mock
preview intentionally never grants Google access, including on a positive answer.
A real expiration grant was attempted on a new disposable form and rejected by
Google. No form publishing or native member data mutations were performed.
