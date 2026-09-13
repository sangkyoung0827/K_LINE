# Mobile My Clubs

The mobile bottom navigation now has three equal-width entries:
My clubs, Home, My journey. Home remains centered; desktop navigation is unchanged.

My clubs opens an accessible native bottom dialog. It reads the two existing
authenticated member-registration GET endpoints only when opened. It does not
modify ECC/Hanhwal APIs, routes, roles, fees, registration records or DB schema.

- Approved registrations appear as joined; submitted registrations show pending
  approval and link to the registration screen.
- Legacy official-member roles without a form are supported. Global developer or
  administrator visibility alone is not treated as joining a club.
- Session/account changes dismiss the dialog and clear its data. No memberships
  are persisted in localStorage, and returned account identity is checked.
- Failed lookups stay distinct from an empty club list and offer a retry. Requests
  have a 12-second client deadline and are aborted when the dialog is unmounted.
- Signed-out users see a sign-in link, without changing existing access controls.
- Escape, backdrop click and close button dismiss the dialog. Focus returns to
  My clubs, body scrolling is restored, and desktop resize dismisses the dialog.

## Verification

- Seven focused membership tests passed (`npm run test:my-clubs`).
- Existing WooHyukmon, ECC approval/outage/read-only and Gathering tests passed
  together with the new tests (`npm run pretest`: 60 tests).
- TypeScript and optimized production build passed.
- Isolated browser fixtures verified both-club, ECC-only, pending, empty, guest,
  partial error/retry, account change, Escape/focus and desktop-resize states.
- Navigation checked at 320, 390, 430 and 1440 pixels. Home center matches half
  the mobile viewport; all three targets are 64 pixels tall with no overflow.

This change remains local on `feat/mobile-my-clubs`. No push, merge, production
SQL, or deployment was performed. The branch also contains earlier unreleased
mobile/Gathering work; review release scope before merging. Full `npm run check`
and Browser Safety CI remain release prerequisites (system Chrome launch was
blocked locally in the existing collection test during the preceding task).
