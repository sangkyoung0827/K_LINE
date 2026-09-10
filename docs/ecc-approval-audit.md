# ECC Approval and Activity Access Audit

Date: 2026-09-10 (Asia/Seoul). Base: origin/main ce5f875.

## Read-only production observations

- The user's open ECC member-management screen displayed 229 registrations, 192 approved and 37 pending. All 192 checked registration emails matched official-member-or-higher entries in the rendered permission table. This is a UI snapshot, not a historical DB consistency guarantee.
- The production GET /api/ecc/activity-statuses endpoint reported tableReady=true and all six activity statuses false: gathering, mt, special, opening, farewell, english-class. Closed activities reject applications even from approved members.
- No real application was submitted and no payment, role, opening status or member data was changed.
- The affected member's email, attempted activity, error message and time are still needed to establish their particular cause. Do not infer non-payment or dishonesty from a failed application.

## Code findings

The activity page and POST API both use getCurrentEccAccess; roles are read by normalized Google login email. The POST also independently verifies that the activity exists, required fields are supplied, and applications are open. Payment does not override closure. A different Google account will not inherit the approved account's membership.

Confirmed retry defect: applyEccMemberAdminUpdate writes the registration first, then the role. If the second write fails, the first write remains. Retrying the same payload previously returned early because the registration no longer differed. That left the missing role unrepaired and could report successful HTTP completion with zero updates.

The isolated fix retries role synchronization for an identical submitted update and returns the registration to the existing UI merge path only after successful synchronization. Approval and revocation retries are tested, as are repeated failures, note-only edits and missing records. Note-only changes do not change roles. Existing higher-role preservation remains in the unchanged approval/revocation helpers.

## Limits and release

This is a recoverability fix, not a new atomic DB transaction. A partial write can still exist until a successful retry; a fresh page with no changed drafts will not send updates automatically. No bulk reconciliation or automatic access widening is introduced. Unexpected role-lookup failures are also currently treated as missing access by existing code and can show a membership denial; that behavior is not changed here.

Keep this hotfix separate from the unfinished Hanhwal parity and website builder branches. No production migration is required. No push, merge or deployment has been performed during this audit; the user's earlier release hold remains in effect until clarified.
