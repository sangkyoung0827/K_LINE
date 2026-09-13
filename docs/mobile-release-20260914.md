# Mobile Navigation Release - 2026-09-14

The user approved deployment after reviewing the mobile preview and club menus.
This release is based on production `2a869b8` and includes only the reviewed mobile
UI commits (`7066a51`, `832d3bf`, `87526c4`), selected onto a separate release branch.

## Included

- Compact phone home, member details, safe-area layout, save controls and map targets.
- Bottom navigation: My clubs, centered Home, My journey.
- My clubs uses existing authenticated read-only self-registration endpoints.
- Mobile menu: Journey profile, expandable ECC and Hanhwal with existing role rules.

## Excluded

- Gathering weekday selection (`c83c4ed`) and its unexecuted SQL migration.
- Club Website Builder and Hanhwal parity draft PRs.
- Authentication, permission, membership/payment handlers and API changes.
- Database changes, test fixtures, secrets and browser/PWA metadata.

## Release Gates

Earlier review documents describe local-only testing at the time of implementation;
this release note records the subsequent deployment approval and narrowed scope.
Local `npm run check` was run: component/permission tests passed, but the existing
collection browser test cannot launch Chrome under macOS process permissions.
Do not weaken tests for this limitation. Require Browser Safety CI and Vercel's
preview build to pass before merging this branch. Verify the live deployment after
merge, without changing production membership or payment records.
