# WOOHYUKMON 1.0 checkpoint: 2026-10-06

## Account and device facts

The owner clarified that neither Apple Developer nor Google Play Console is
registered. An iPhone is available without USB. No Android test device has been
confirmed. Registration, identity verification, payment and binding terms belong
to the owner. No enrollment, purchase or acceptance was performed by the agent.

Official enrollment:
- https://developer.apple.com/programs/enroll/
- https://play.google.com/console/signup
- https://support.google.com/googleplay/android-developer/answer/14151465

Wireless TestFlight is the intended iPhone test path after enrollment and a signed
build; this is not already completed. Qualifying new personal Play accounts may
need 12 continuously enrolled closed testers for 14 days. Review timing is external
and the November deadline is a target, not a guarantee.

## Implemented in this branch, not production

- Independent SDK 57 React Native project; iOS/Android identities, splash, icon,
  deep-link event routing, five tabs and Korean/English text.
- Native browser login handoff, one-use PKCE exchange, opaque revocable sessions,
  SecureStore and active K_LINE identity lookup on each authenticated request.
- Additive server-only `woo_v1_*` organization/event/application/attendance/memory/
  announcement/moderation/session tables with RLS, service-only RPCs and audit.
- Concurrent event lifecycle independence, unique applications, event-row locking
  for capacity/waitlist decisions, revision conflicts and form immutability after
  applications.
- Organization/event manager boundaries; native event draft forms, editable
  questions, AI draft review, explicit opening/closing, application review and
  attendance confirmation screens.
- AI provider reuse with no private chat-history injection, sensitive-question
  guard and review before publishing.
- Verified attendance and event completion gate memory creation. Private photos
  use a separate bucket, server authorization and 60-second signed links. Server
  re-encodes photos to strip EXIF. Consent, reports, blocks and organizer moderation.
- Account deletion request queue immediately revokes app sessions. This is a
  request, NOT completed deletion; see blockers below.
- Backend default-off feature flag. Existing web club pages, forms, membership
  writes, browser metadata and public photo bucket were not changed.

The two root configuration edits isolate native TypeScript dependencies and
externalize the new native image-processing package for server bundling. The first
Next build exposed a `.node` bundling error; explicit serverExternalPackages fixed
it. No legacy route code was altered.

## Validation performed locally

- Root `npm run typecheck`: pass.
- Native `npm run typecheck`: pass, including after SDK-compatible patch updates.
- `expo install --check`: pass.
- `expo export --platform all`: iOS, Android and web bundles generated, including
  after the React Native SDK-compatible patch update. These are NOT signed apps.
- `expo prebuild --no-install`: generated iOS/Android projects. Native compiler,
  CocoaPods/Gradle/signing and physical testing were NOT run.
- New pure-model tests: 4 pass.
- Isolated PGlite PostgreSQL command tests: 8 pass.
- Private-bucket/server-isolation tests: 2 pass.
- Root `npm run build`: pass after native package bundling repair.
- V4 isolation and Hanhwal isolation scripts: pass.
- Browser metadata safety: pass.
- Exported native-web preview: all five tabs, anonymous login gates and Korean/
  English switching verified using the connected browser. Image source loaded.
  At 390 x 844 and 1280 x 800, no horizontal overflow; screenshots saved outside
  the repository. Console warning/error capture was empty. Live backend event
  loading is NOT validated: the new API has not been rolled out.
- Root `npm run check`: NOT fully passed. Existing pretests completed, then an
  existing traditional-liquor browser test could not launch Chrome in the sandbox
  (SIGABRT/EPERM). Do not waive this; CI remains required before any merge.

The PGlite capacity test exercises serialized database commands, not a real
multi-connection concurrent load test. Native-device OAuth, live AI and photo flows
have not been validated. No production migrations or production test applicants were
created. Both SQL files must first be reviewed and exercised in private staging.

## Security/tooling findings

Native npm audit: 24 transitive findings, 8 moderate/16 high at this checkpoint,
including development Metro/Expo tooling. Latest registry braces and node-forge
were still affected. Do not force npm's suggested downgrade to Expo 44/RN 0.72;
review official patches and reachability before release. UUID's xcode dependency
also needs a compatible upstream fix. No warning is claimed resolved.

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-w5hq-g745-h8pq

Metro live development hit the Mac watcher limit and a blocked DevTools cache
directory. Export succeeded. A static exported preview can verify navigation but
does not replace native login/device tests. agent-browser could not create its
socket directory in the sandbox; use the connected browser for visible checks.

## Mandatory remaining work

1. Private staging: apply the two migrations, set paired staging DB credentials,
   connect the existing read-only identity source and explicitly enable the app.
   Complete native OAuth, revoked/expired sessions, role isolation, applications,
   capacity races, real AI drafting and signed-photo upload/display tests.
2. Complete event edit/duplicate/admin invitation/organization member workflows,
   calendar pickers, localization persistence, pagination and participant history.
   Current creation starts as a draft and requires explicit manager opening.
3. Reuse Google Forms only through a verified per-organizer OAuth/access model;
   current ECC-admin integration is not silently expanded to all app users.
4. Deletion worker and confirmed data/photo purge, retention policy, deletion
   status and owner handover. Preserve shared K_LINE identity/club records unless
   the user explicitly requests their separate deletion.
5. Store-ready policy/contact, UGC filtering and moderation/report queue,
   photo removal and block reversal, abuse/rate limiting, session retention and
   equivalent privacy-preserving login/Sign in with Apple where required.
6. Resolve/mitigate dependency warnings, run all CI and regression tests, confirm
   final identifiers and developer ownership. Avoid logging tokens/private answers.
7. Signed IPA/AAB, iPhone TestFlight and physical Android testing. Verify OS photo
   permissions, app restarts, deep links, backgrounding, slow network, accessibility,
   duplicate taps, keyboard and native navigation. Browser QA is not device QA.
8. Register listings, privacy/data-safety declarations, screenshots, review account
   and owner-controlled signing; submit, respond to review and verify public install.

Keep each release-status flag false until its corresponding evidence exists.
Existing K_LINE/ECC/Hanhwal remain in service throughout. Do not merge or deploy
this unfinished branch merely because JavaScript bundles export successfully.

## Google account follow-up (2026-10-07)

Web Google login and the read-only existing K_LINE identity endpoint are implemented
with a separate default-off auth flag. Real Google sign-in and the existing member
profile, plus reload persistence, were verified in the loopback browser preview.
That preview uses the existing test OAuth client and an isolated session adapter,
not deployed NextAuth or a physical native device. The production Google provider,
member data, club roles, Forms scopes and environment settings remain unchanged.
See [google-account-linkage.md](google-account-linkage.md) for exact evidence,
same-origin hosting requirements and remaining native/production checks.

The first login commit passed Browser Safety CI; its native CI found newer Expo
SDK-compatible patches rather than a typecheck/auth test failure. The follow-up
updates only native Expo/constants/image-manipulator to 57.0.27/57.0.21/57.0.21.
The root web lockfile remains unchanged. Native audit now reports 23 findings
(8 moderate/15 high); root audit reports 19 (5 moderate/11 high/3 critical).
These warnings remain release gates, not evidence of completed security review.
