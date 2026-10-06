# Google Forms / WooHyukmon Deployment Handoff

## Release State

Saved at the user's request on 2026-10-06. No push, merge, production deployment,
production feature activation or production login changes are authorized by this save.
Resume from branch `feat/google-forms-woohyukmon-v5`; use a PR, not a direct main push.

## Completed Work

- Reuse the existing WooHyukmon API for approval-gated new-activity form planning.
- Activity-specific bilingual announcements use existing verified notice knowledge,
  keep the application link separate, and do not fabricate dates or locations.
- Simplified form actions, names-only applicant rosters and automatic group notices.
- ECC respondent entry checks payment AND approval; transient lookup failures alone
  offer the WooHyukmon payment question.
- Account/form-bound temporary grants with durable leases, exact permission IDs,
  per-form locking, supervised-worker heartbeat checks and server-side revocation.
- Additive test-only SQL was applied to the existing Supabase project, with RLS and
  no browser-role read access. Existing member/payment tables were not changed.

## Verification

- 47 Google Forms tests and 16 ECC approval/outage/read-only regression tests passed.
- Typecheck, build and diff whitespace checks passed.
- Actual Google OIDC login and form access were verified for the approved test account.
- Controlled outage: negative answer shows payment guidance; positive answer creates
  an active expiring lease and respondent-only Google permission.
- Normal membership lookup promotes the lease without changing native membership.
- Mobile UI and actual respondent form at 390px showed no horizontal overflow.
- Separate 30-second live integration verified automatic permission deletion after
  expiry. The full 15-minute elapsed wait was not repeated.
- No application response was submitted during the final browser entry test.

Detailed evidence: `google-forms-final-entry-verification-20261006.md` and
`google-forms-server-revocation-integrated-20261006.json`.

## Required Before Production

1. Inspect current main and preserve existing ECC/Hanhwal/SIU native application data.
2. Resolve the intentional test-only environment gates and design the production
   configuration/migration explicitly; do not merely toggle the test flags.
3. Verify production NextAuth authentication, callback/session behavior and ordinary
   member access. The current participant preview uses isolated Google OIDC.
4. Install a persistent supervised revoker/scheduler and monitoring before enabling
   temporary access. The local 30-second worker stops if its local process stops.
5. Restrict responder permissions before activation. Google creates broad responder
   permissions on some new forms even while unpublished. Native expiry was rejected
   by the connected account, so it must not be advertised as supported.
6. Decide how permanent responder grants are removed when member approval changes;
   full paid-member allowlist synchronization is not yet implemented.
7. Address/test multi-account Google selection: a bare respondent URL can open under
   the default Google account rather than the KLINE-authenticated account.
8. Re-run repository-required `npm run check` / browser-safety checks, build and
   a production-like preview; the 63 focused tests are not the full merge check.
9. Obtain explicit approval for release scope, merge and production activation.

## Local Preview and Recovery

- Participant preview: `http://localhost:3300/`.
- Current original checkout: `/tmp/kline-hanhwal-admin-20261002`.
- Persistent backup: `KLINE-GOOGLE-FORMS-20261006.tar.gz` in the shared workspace,
  preserving the checkout and its shallow Git metadata. Do not use a Git bundle
  from this shallow source: a trial bundle verification passed but cloning failed
  because it did not carry the source repository's shallow boundaries.
- Persistent checkout: `kline-google-forms-checkpoint-20261006` in the shared workspace.
- Private local test configuration is copied only into the persistent checkout's
  ignored `private/` directory with restrictive permissions; it is not in Git or
  the compressed code backup.
- Downloaded OAuth client JSON remains in the user's Downloads directory. Do not
  publish it or include it in commits.
- Test registry identifiers in `private/ecc-entry-final-preview.local.json` identify
  the current restricted, labeled final-test form. Preserve that metadata for cleanup.
- SIGINT/SIGTERM to the local participant preview attempts to unpublish its test form.
- Tomorrow's persistent checkout needs dependencies installed before running tests.

Do not infer that saving means the implementation is production-ready or deployed.
