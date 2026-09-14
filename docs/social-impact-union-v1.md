# Social Impact Union V1

## Release scope

- Base: latest `origin/main`, `5acfa7f3067d2000b17ee5b2915944861a809026`.
- Branch: `feat/social-impact-union-v1` (separate from held website-builder and Hanhwal-parity work).
- Public route: `/social-impact-union`.
- Exact owner-supplied URL: `https://open.kakao.com/o/gOIWwoni`.
- No Project JIT cards, activities, applications, memberships, roles, database changes, migrations, preference engine changes, or WooHyukmon integration.

## Inspected production patterns

Read `AGENTS.md`, `package.json`, `src/app/page.tsx`, `src/components/Navbar.tsx`, `MobileNavigationMenu.tsx`, `HomeTrackSections.tsx`, `ClubMark.tsx`, `Logo.tsx`, `AuthStatus.tsx`, `LanguageProvider.tsx`, `CTAButton.tsx`, `SectionHeader.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `src/lib/seo.ts`, `src/app/sitemap.ts`, and `src/middleware.ts`.

Also inspected the International Clubs hub, ECC/Hanhwal public and registration pages, Hanhwal official page, ECC/Hanhwal QR routes, mobile-navigation regression tests, and the Browser Safety workflow.

## Reuse and implementation

- Home: append the SIU data entry between Hanhwal and Memory Book, rendered by the **same `HomePortalCard`**, not a new card implementation. Existing ECC/Hanhwal entries are unchanged.
- Identical wrapper, border, radius, spacing, hover state, icon sizes, CTA, and breakpoints: mobile `grid-cols-[44px_minmax(0,1fr)_20px]`, `sm:flex`, `md:min-h-[292px]`; containing grid `md:grid-cols-2 xl:grid-cols-4`.
- Navbar: independent top-level link, outside the International Student Club dropdown. Desktop link gaps are reduced to accommodate the additional destination; breakpoints and conditional Developer/cart logic are unchanged.
- Mobile: independent link below the two existing club accordions. No change to the three-item bottom navigation, club permissions, or My Clubs membership logic.
- Page: Hanhwal-style `max-w-4xl`, `py-10 sm:py-16 md:py-24` header spacing; existing `paper-panel` open-chat surface, centered QR, `max-w-52 sm:max-w-60`, and minimum 48px CTA.
- Localization: existing `I18nText` / `LanguageProvider` only.
- Temporary mark: lightweight React SVG, three nodes and a continuous connecting curve, existing navy/brass colors. Decorative beside the written organization name; not described as official CI. No browser/PWA icon changes.
- QR: existing `qrcode` dependency generates a 720px PNG data URL during static page rendering, M error correction and four-module quiet zone. No third-party QR service, extra API route, or new runtime dependency.
- Link: native anchor with exact URL, `_blank`, `noopener noreferrer`, external-link icon, screen-reader new-tab notice, and visible keyboard focus.
- SEO: existing public metadata helper and sitemap registration. Only the exact new public route is added to the middleware allowlist; existing protected routes and future SIU subroutes remain protected.

## Files

Created:
- `src/data/socialImpactUnion.ts`
- `src/components/social-impact-union/SocialImpactUnionMark.tsx`
- `src/app/social-impact-union/page.tsx`
- `scripts/social-impact-union.test.mjs`
- `docs/social-impact-union-v1.md`

Modified:
- `src/components/HomeTrackSections.tsx`
- `src/components/Navbar.tsx`
- `src/components/MobileNavigationMenu.tsx`
- `src/app/sitemap.ts`
- `src/middleware.ts`
- `scripts/mobile-navigation.test.mjs` (new public destination assertion, existing permission assertions preserved)
- `package.json` (SIU tests included in pretest)

## Verification

- SIU tests: 7 passing, including real markup/QR generation, bilingual content, identical home-card wrappers, public metadata, exact-route middleware behavior, and conditional Developer/cart navigation.
- Browser checks: 320px/390px mobile, 1024px and 1440px desktop; no SIU text overflow. At 1440px, all four home cards measured 299px wide and 426px tall. Mobile uses the same compact layout; long titles wrap naturally.
- Mobile menu: separate SIU destination, existing ECC/Hanhwal accordions preserved.
- Anonymous page: HTTP 200 after the exact-route allowlist addition; no ECC/Hanhwal role required.
- QR decoded from the rendered page PNG using temporary QA-only `jsqr`/`pngjs`: exactly `https://open.kakao.com/o/gOIWwoni`. These QA packages are not added to the project.
- QR alt text, actual DOM href, minimum CTA size, and keyboard focus outline checked. SVG is hidden from assistive technology because its adjacent text supplies the name.
- Local full check reaches an existing traditional-liquor test which cannot launch Chrome in the filesystem/process sandbox (`EPERM` / `SIGABRT`). No test was removed, skipped, or weakened. Full Browser Safety CI must pass before merge.
- Release gate: rerun typecheck/build after final edits, verify latest main has not advanced, require green Browser Safety CI, then merge the isolated PR. Record the final production deployment and verification in the PR/final report.

## Limits

The owner supplied the organization description and invite URL; no claim of verified official CI is made. Actual Kakao room participation is not performed. No payment, registration, membership, rating, or activity record is created for testing. Existing OAuth credentials, roles, and business data are not changed. This V1 intentionally contains no further SIU functionality.
