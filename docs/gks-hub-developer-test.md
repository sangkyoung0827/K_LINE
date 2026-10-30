# GKS Hub Developer Test

## Scope

- Route: `/gks-hub`; home card is server-rendered only for approved developers.
- Reuses the existing Google/Auth.js session and `isDeveloperEmail` policy. A club administrator or global super administrator is not sufficient. No new account is granted a role by this release.
- Both the page and `/api/gks-hub/access` recheck the authenticated server-side identity. The API returns 401 to guests and 403 to other users. The page returns not-found to unauthorized sessions; the existing middleware sends guests to login.
- The page is dynamic and noindex, excluded from the sitemap. No standalone HTML or draft data is placed in `public/`.

## Working Features

- 250 country/region names searchable in Korean, English or ISO code; this is not a list of scholarship-eligible nationalities.
- Four university examples plus arbitrary university and department entry. No recruitment status is asserted.
- Degree, application-track and university-scoped checklist, notes, preparation status and actual required-document progress.
- Form 2 and Form 3 editing, separate drafts, Korean/English document headings, live preview and real DOCX downloads using the existing `docx` dependency.
- No mock admission probability, mentor matching, official submission, AI call, database write or external upload.

## Data Handling

Test drafts stay in `sessionStorage`, namespaced by a server-derived SHA-256 account key. They survive reload in the same tab but are not a cross-device or permanent storage system. The editor hides on session/account changes; a fresh authorized API response is required before export. Browser storage failures are shown without falsely claiming a successful save. Do not enter sensitive personal information in this test tool.

No database migration, storage bucket, environment variable or production membership change is required. Yuki's existing read-only operational access is unchanged; editing local GKS drafts and generating a file does not write operational data.

## Reference Provenance

The checklist and editor fields were ported from the supplied `GKS_Hub_Standalone.html` in `GKS_Hub_Developer_Test_Package.zip`. This is explicitly labeled a 2026 reference snapshot. Generated documents are preparation drafts, not official application forms. Applicants must verify the current official notice and final forms. The original package's conflicting browser-storage keys and unescaped HTML interpolation were not carried over.

## Verification

`npm run test:gks-hub` tests the actual access helper, page, home gate, API, nationality matching, filters, bounded restore and generated DOCX contents. It uses isolated identities and never accesses the operational database.

`node scripts/gks-hub-preview.mjs` starts a loopback-only fixture at port 3384 (override with `PORT`). Only this fixture supports `?role=developer|member|superadmin|guest`; production routes do not support role overrides. It bundles the real editor with an isolated identity provider and exercises the real access API policy. It is not imported by production application code.

Required repository validation: `npm run check` and Browser Safety CI before merge. UI checks cover input, same-tab draft recovery, university selection, checklist status, both form previews, a downloaded Word document, and desktop/mobile layout. Release checks must confirm the canonical production site, developer-only card/page, and anonymous API denial.
