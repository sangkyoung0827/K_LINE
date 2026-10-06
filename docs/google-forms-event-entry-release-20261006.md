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
