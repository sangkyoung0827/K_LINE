# Web Memory Book Handoff

## Scope

- Replace Memory Book entry points in the desktop navbar, mobile menu, mobile bottom navigation and home cards with the existing Woohyukmon glasses asset.
- All visitor types can explicitly open the conversation. Only server-verified, non-read-only organizational scopes enable management operations. Failed or mismatched scope responses fall back to general conversation without granting management access.
- `/jeju` displays a bilingual app handoff notice. Existing profile, memories, map, discover, AI, program and place addresses redirect to that notice. Only these notice addresses are public; future `/jeju/admin` pages remain protected.
- The app is not advertised as released. No invented App Store / Play Store links are provided.
- The app uses its separate `/api/woohyukmon-app/v1/kline/view` embed rather than the retired web page. Existing memory components, APIs, photos, records, RLS and browser installation metadata are preserved. No database migration or production data changes.

## Mobile Behavior

- Dialog height adapts to dynamic / visual viewport height; bottom inset follows the visual viewport when a mobile keyboard resizes it.
- Conversation content scrolls internally. Long prompts have a bounded height and wrap without page-wide horizontal scrolling.
- Close and send controls have 44px touch targets; mobile input text is 16px.
- The bottom navigation is hidden while the conversation is open; the mobile floating launcher is hidden to avoid duplicate overlapping controls.
- Escape closes the dialog; Tab stays inside it; focus returns to the opening control, or the menu button when the original menu item was removed. Opening from the menu releases that menu's body-scroll lock before the dialog takes over.

## Verification

- `npm run pretest`: passed, including existing club, member, research, event archive, activity and approval regression suites.
- `npm run build`: passed, including type checking.
- `npm run verify:browser-metadata`: passed.
- `npm run check:v4-isolation`: passed.
- `npm run check`: attempted; the full run reaches the existing traditional-liquor browser collection test, where sandboxed Chrome launch aborts with SIGABRT / EPERM. This is not a full local check pass. Browser Safety CI must complete on the PR before any merge.
- New isolated tests cover guests, members, admins, read-only developers, identity mismatches and failed access reads. No production membership or chat records are created.
- Local optimized-build browser checks cover 320px, 390px, 430px, 768px, 844px landscape and 1440px desktop. A 390x400 reduced viewport checks composer fit. Bilingual app notice, menu and icon entry points are checked in the browser.
- Actual iPhone / Android virtual keyboard behavior has not been tested on a physical device. Reduced viewport checks are not a substitute for that test.
- Browser Safety includes a local-only mobile smoke step; it sends no AI prompts and writes no operational records.

## Release

Review PR only, per user instruction. Do not merge, promote a preview, or deploy to production without a separate approval.
