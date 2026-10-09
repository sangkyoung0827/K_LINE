# K_LINE Design Alignment

Date: 2026-10-07

## Scope

Restyle the independent WOOHYUKMON app, not the K_LINE production website.
The UI implementation change is confined to `mobile/woohyukmon/App.tsx`.
No backend routes, authentication configuration, database schema, membership
records, application logic, native app icons, or release flags were changed.

## Design

- Reuse the K_LINE paper (#F4EBDD), navy (#1F2A44), brass (#D6A85A),
  ink (#111827), and muted (#4B5563) palette from `tailwind.config.ts`.
- Match K_LINE serif branding and sans-serif body typography using platform
  system fonts; no new font service or dependency.
- Retain the WOOHYUKMON name and existing glasses bitmap.
- Use warm panel surfaces, navy primary buttons, rounded inputs with brass
  focus borders, and a selected-icon background like `MobileBottomNav.tsx`.
- Preserve Home, Events, Memories, Create, My and their existing routes.
- Retain keyboard-aware scrolling, native safe areas, disabled controls,
  language switching, authorization gates, and Google login behavior.
- Present account identity in an unframed row and language choices as a
  segmented control. No new profile data or account operation.

## Validation

- Native and root `npm run typecheck`: passed.
- `expo export --platform all`: web, iOS and Android bundles generated.
- Root `npm run build`: passed; existing workspace-root warning remains.
- App database/authentication/isolation tests: 11 passed.
- App model tests: 4 passed.
- `npm run check:v4-isolation`: passed.
- `npm run verify:browser-metadata`: passed.
- `git diff --check`: passed.
- Local browser preview at 320x740, 390x844, and 1280x900: controls
  rendered without horizontal overflow; Korean/English switching and all
  five tab routes verified. Logo loaded, heading accessible, no error overlay.
- Final 390px My screen: five tabs, zero overflow, no captured console errors.

Screenshots are stored outside the repository in
`outputs/woohyukmon-1-20261006/kline-style-my-390.png` and
`outputs/woohyukmon-1-20261006/kline-style-my-1280.png`.

The static export was copied into the existing localhost:8097 preview without
restarting its authentication server. The previous one-hour test login session
had expired; current UI verification used the signed-out screen, not fabricated
account data. No authenticated create/manage/upload mutations were exercised
in this design pass. Event services remain disabled; their unavailable state
was retained rather than masked with dummy production data.

## Release Boundary

This is a saved local UI revision on the existing feature branch, not a
production deployment or a store release. Native bundle exports are not signed
installable builds. Real-device, signed-build, and store verification remain
pending. Existing release status flags and dependency-audit findings are
unchanged. No main merge or production promotion was performed.
