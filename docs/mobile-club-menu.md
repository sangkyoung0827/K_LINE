# Mobile Club Menu Preview

Local-only follow-up to the My clubs bottom navigation. Not deployed or pushed.

## Scope

- Mobile hamburger menu: My Journey profile, ECC, Hanhwal.
- The profile entry links to the existing `/jeju/profile` page.
- Club groups use native keyboard-accessible, initially collapsed disclosures.
- Existing club home, registration and official links are grouped under their club.
- Official members get shortcuts to existing activity and board pages.
- Administrative shortcuts retain the corresponding official page's visibility rules.
  ECC funds require admin; Hanhwal funds still require superadmin.
- Language controls and desktop navigation are unchanged.
- Long menus scroll within the viewport. Escape and desktop resize still close the menu.
- No authentication, club API, DB, membership, profile, or payment code changed.

## Validation

- Five menu rendering/permission tests and all 60 existing pretest tests passed.
- Typecheck, production build, browser safety and Hanhwal isolation passed.
- Browser checks used synthetic local fixtures, never production member records.
- Verified mobile screenshots, 48px targets, no horizontal overflow, inner scrolling,
  ECC expand/collapse with click and Enter, Escape/focus restoration, and desktop close.
- Tested widths 320, 390, 430, 768 and 1440px. Temporary viewport override restored.

No new SQL is needed for this menu change. Earlier local work remains held, including
the unexecuted Gathering-days migration; this branch is not release approval.
