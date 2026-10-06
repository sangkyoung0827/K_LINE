# ECC temporary respondent access: integration result

- Account: samgkyoung1004@gmail.com.
- Actual Supabase test schema creation succeeded through the logged-in SQL Editor.
- RLS is enabled for leases, locks and revoker health; public/member SELECT is
  denied and server SELECT is allowed.
- Real Google respondent permission and DB-backed lease were created successfully.
- Accelerated 30-second expiry was used; the user-facing route still issues 15 minutes.
- The real worker preserved access before expiry and revoked one tracked permission
  after expiry. DB state became revoked and Google permission absence was verified.
- No retry or attention errors occurred in the successful run.
- Temporary publication was restricted to the disposable test form. It was
  unpublished, permission cleanup verified, and moved to recoverable trash.
- The first attempt stopped on the default public responder permission and cleaned
  up. The subsequent attempt removed only the new disposable form's default public
  grant before proceeding; existing forms were not changed.
- Existing native payment, approval and membership data were not changed.
- The membership outage was controlled for this test; real authenticated UI access
  and post-expiry respondent-browser behavior remain to be tested.
- Production deployment, gate activation and persistent scheduler setup were NOT
  performed. A supervised frequent worker is required before activation.

Machine-readable proof: google-forms-server-revocation-integrated-20261006.json.
