# Event Creation Entry Release Preparation

## Requested Change

The ECC official admin menu replaces the visible Fund Management entry with
Create Event / 행사 만들기 at `/admin/google-forms`. The original fund implementation
is retained. Native activity entry, application form, APIs and database are unchanged.
The menu arrow now moves once on hover, remains stable on small screens, and
honors reduced motion. The command send icon has a localized tooltip and focus ring.

## Verification

- Latest remote main inspected via fetch.
- Typecheck and build pass.
- Added an admin-only menu/native-route preservation regression test.
- The desktop/mobile UI fixture verifies separated notice/link output and names-only
  applicant groups; 390px viewport has no horizontal overflow or raw/email answers.
- Updated obsolete CI browser assertions and isolated its fixture port from the
  user's existing preview; provided a deterministic fixture Google form ID.
- `npm run check` did not complete: its unrelated traditional-liquor collection test
  cannot start Chrome in the current local sandbox. Do not report the full check green.
- The UI test command initially failed because port 3317 was already occupied. Browser
  behavior was subsequently inspected through the in-app browser on isolated port 3333.

## Release Blockers

No production deployment has been performed for this change. The existing integration
explicitly rejects Vercel production in its test-only environment guard. Publishing
only this menu would point administrators to a disabled page, not a working launch.

The user was asked whether to release only administrator form/notice/group tools first
or finish respondent gating and temporary access for the same release. Production
configuration and ordinary NextAuth authentication still require integration/verification.
Respondent temporary access additionally requires a persistent supervised revoker and
monitoring; this must not be simulated by a browser timer or silently disabled guard.

Preserve the existing KLINE application system until an explicit later retirement task.

## Administrator-Only Production Release

The user approved administrator tools first on 2026-10-06. Production uses explicit
`GOOGLE_FORMS_ENVIRONMENT=admin-production` and administrator opt-in. The store
always uses the separate `kline_forms_live_` namespace. The additive migration
creates seven server-only tables, enables RLS and revokes browser-role access.
Only the approved encrypted operations account connection was copied from the test
namespace; test forms, responses and member data were not copied.

Production access is restricted to ECC administrators and existing global super
administrators. Read-only developer restrictions remain. Respondent gating, temporary
entry and public notice publication are forcibly disabled in this release, even if
test flags are accidentally enabled. Existing native applications remain intact.
Forms are created as drafts; administrators publish them from the Google original
before sharing the separately generated notice and application link. OAuth reconnect
is disabled until a production redirect is registered; the previously approved
operations refresh connection is reused without changing KLINE login credentials.

Local checks: 49 Google Forms tests, typecheck, production build and browser metadata
validation pass. Full regression/browser execution must pass in CI before merge.
