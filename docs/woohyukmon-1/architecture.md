# WOOHYUKMON 1.0 architecture and release checkpoint

Target: installable iOS and Android apps before 2026-11-02. Owner: the existing K_LINE repository owner. No production rollout in this checkpoint.

## Observed baseline (2026-10-06)

- K_LINE: Next.js 15 App Router, React 19, NextAuth Google JWT sessions, existing site_members identity.
- Supabase: server-side REST access with service-role credentials; ECC/Hanhwal membership and applications are separate tables. Their existing IDs and permissions must remain unchanged.
- AI: src/lib/woohyukmon/generation.ts provides Gemini/NVIDIA/OpenAI failover, deadlines and refusal handling. Reuse without private conversation injection.
- Google Forms: src/lib/googleForms provides approved operations OAuth, encrypted refresh tokens, idempotent creation and response mirrors. Current production mode is ECC-admin-only, not universal creator access. Do not loosen it to support the app.
- Memory: Jeju place/visit/review records and the integrated K_LINE activity-history view exist. The history route explicitly says the date is registration close, not verified attendance. It cannot be converted into attended events automatically.
- Existing Jeju upload URLs use a public bucket. New nonpublic event photos must use a new private bucket, not change Jeju storage.
- No universal events/organization engine or native app project was found. New event-owned data is necessary; this does not duplicate existing native ECC/Hanhwal records or copy member accounts.
- This Mac has CommandLineTools, not full Xcode; adb/Android SDK not found. User has an iPhone without USB and no enrolled developer-store accounts.

## Decision

Native Expo / React Native app in mobile/woohyukmon, with isolated dependency lockfile and TypeScript configuration. Reuse K_LINE as API host, identity provider, server AI and Supabase backend. No WebView wrapper and no rewriting existing club UIs. Existing web tsconfig excludes the native project to avoid native/web dependency collisions.

Mobile browser login uses existing K_LINE NextAuth authentication. A one-use, short-lived code is bound to PKCE S256 and native callback state; exchange returns an opaque, revocable session stored in OS SecureStore. No Google/Supabase secret belongs in app builds. Sign in with Apple/equivalent privacy-preserving login is a submission gate, not assumed compliant because web Google login works.

New woo_v1_* tables are server-only and feature-flagged. Requests validate member identity on every session use; organization/event permissions are checked for each operation. Database commands serialize capacity decisions per event and atomically record audit changes. Application is not attendance. Verified attendance plus a completed event determines personal memory access. Photos are private, access-controlled and never face-matched.

Existing card design tokens inform native spacing/type; web DOM components cannot be directly imported into React Native. Existing server AI generation is reusable; its ECC-specific form planner is not a universal planner. Current Google Forms creation is retained as a separate audited administrator workflow until per-owner OAuth and app response mapping are verified.

## Release gates

All initially false: DEVELOPMENT_COMPLETE, TESTING_COMPLETE, SUBMITTED, APPROVED, PUBLISHED.

1. Core API/database and mobile screen implementation with tests.
2. Private staging migration and real login/AI/photo/application QA; no production club changes.
3. Native development builds, iPhone TestFlight and Android physical testing.
4. Privacy policy/operator contact, data deletion completion, UGC filtering/report/block/moderation, Apple login, per-organizer Google OAuth.
5. User enrolls Apple Developer and Play Console; verifies identity, pays and accepts terms personally. Register final bundle/package identifiers under the user's account.
6. Store listing, privacy/data-safety declarations, screenshots, review account, signed IPA/AAB and submission receipts.
7. Track review separately from approval and public installation.

New personal Play accounts may require 12 testers continuously enrolled for 14 days. Start eligible closed testing early enough; external review timing is not guaranteed.

## Primary documentation

- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/guides/authentication/
- https://docs.expo.dev/build/setup/
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://supabase.com/docs/guides/storage/buckets/fundamentals

Store deadlines and requirements must be rechecked before submission.
