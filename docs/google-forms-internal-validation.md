# Live Google Forms Internal Validation

Production recruitment and public notice publication remain disabled by default.
An operator can authorize at most two synthetic ECC forms for response testing
with the server-only `GOOGLE_FORMS_INTERNAL_TEST_FORMS` configuration:

```json
[{"registryId":"<registry UUID>","googleFormId":"<actual Google ID>","issuedAt":"<ISO timestamp>","expiresAt":"<ISO timestamp>"}]
```

Both identifiers must match, the title must identify a test, the form must not
be archived, and the grant may last no longer than 24 hours. The production
status API additionally requires the existing writable superadministrator
permission, same-origin request, and explicit internal-test confirmation.
Ordinary operation tokens, club administrators, and maintenance requests do
not receive this production publication exception.

Only eligible forms display internal-test open/close controls in the existing
applicant manager. An expired grant prevents reopening but allows closing its
already-open form. Grant expiry is **not** a scheduled Google Form closure.
Always close test forms before ending validation, preserve their originals,
and remove the temporary configuration after verification. No public notice
may be posted by this exception.

Verify actual respondent submissions, required questions, duplicate-free
manual response synchronization, closing/reopening, and A/B isolation.
Record Google response IDs separately from mock test results. Capacity is
planning metadata, not an automatic Google response limit. The maintenance
route exists, but the repository does not install an automatic sync cron.

An external Google OAuth app in Testing can issue refresh tokens expiring in
seven days for Forms/Drive scopes. Production readiness requires a separately
reviewed Google OAuth publication/verification plan, not relaxed security or
permanent test-user access changes.
