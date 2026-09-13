# Mobile usability review

Date: 2026-09-13
Branch: `feat/mobile-usability`, based on `2a869b8`.
Status: local implementation only; not pushed, merged or deployed.

## Scope

- Compact phone home links and a four-destination bottom navigation.
- Shorter phone header; language switcher in the expanded phone menu.
- Collapsed secondary membership details on phones; expanded details on desktop.
- ECC mobile save action uses the existing save handler and dirty-registration list.
- Map record touch targets, wrapping titles, and mobile map height.
- Keyboard-focus/menu handling and safe-area spacing for fixed controls.

No API routes, database migrations, membership/payment handlers, authentication,
permissions, production data or browser/PWA metadata were changed.
Existing unshipped club-builder and Hanhwal parity work remains separate.

## Verification

- Production build, TypeScript, browser metadata validation: passed.
- ECC approval retry, outage entry and read-only developer tests: 16 passed.
- WooHyukmon tests: 29 passed.
- Import, intents, analytics, business collection, announcements, Jeju check-in,
  tracking and market collector tests: passed.
- Collection safety, browser safety, Hanhwal isolation and V4 isolation: passed.
- `npm run check` stopped at the existing collection engine browser test:
  local Chrome could not launch under macOS process permissions. Standalone
  Playwright headless-shell launch also reported MachPort permission denial.
- In-app browser viewport checks: 320, 390, 430, 768 and 1440 pixels;
  no home horizontal overflow, phone links 96-106 pixels tall,
  bottom navigation hidden on desktop.
- Korean/English home and menu checked; menu escape and viewport transitions checked.
- Actual membership components rendered in a separate local fixture with synthetic
  `example.invalid` records, no network API/database connection. Checked disclosure
  open/close, retained notes, checkbox state, top save and mobile save action,
  keyboard-focus navigation hiding, and desktop detail visibility.

`node scripts/mobile-layout.smoke.mjs` provides a repeatable local-only home and
navigation check where Playwright launching is available.

## Before production

- Run Browser Safety CI and the full suite in an environment permitting Chrome.
- Check iOS Safari and Android Chrome keyboards/safe-area behavior on actual devices.
- Check authenticated Journey/Google Maps on a configured preview. Local testing
  deliberately has no production Google/Supabase credentials and redirects to login.
- Obtain deployment approval. Do not deploy the unfinished builder/parity branches.
