# WOOHYUKMON Installation and Release

Date: 2026-10-07

## Verified Build Receipt

The GitHub Actions Android preview build succeeded on 2026-10-07:
https://github.com/sangkyoung0827/K_LINE/actions/runs/37501743355

- Source branch head: `670ecd8d4ad1b48a73b94b9b482d8a3b87862d0d`.
- CI checkout (PR merge commit): `20907156482eceaa64191ab6994f9befaa35bb30`.
- APK size: 34,351,755 bytes.
- SHA-256: `3fb8dfdbd70e69339428f9afb0e57bac079c2bee1697eb3749c52b4c1d024eef`.
- App name: `우혁몬(WOOHYUKMON)`; package: `com.kline.woohyukmon`.
- Minimum Android SDK: 24; target SDK: 36; architecture: arm64-v8a.
- Signature: Android Debug template, verified by Android SDK apksigner.
- JavaScript bundle embedded; camera, audio recording and overlay permissions absent.

Downloaded APK bytes were independently hashed locally and matched the workflow
receipt. The retained file is under the workspace's
`outputs/woohyukmon-1-20261006/android-preview-20261007/android/app/build/outputs/apk/release/app-release.apk`.
The artifact also includes badging, permissions and verification JSON.

This receipt supersedes the earlier checkpoint statement that no cloud build had
occurred: a GitHub Actions native TEST build has now occurred. No EAS store build,
owner signing credential, store submission or production rollout occurred.
The APK's digital signature does not make it an owner-signed store binary.
All development/testing/submitted/approved/published completion flags remain false.
Both developer accounts remain unenrolled, as confirmed by the owner.

## What This Artifact Is

The Android preview workflow compiles a real arm64 APK with embedded JavaScript
and the Expo-generated Android Debug test certificate. It does not need a local
Metro server. It is NOT signed with the owner's Google Play upload key, NOT a
Google Play release, and NOT an iPhone application. The provisional package is
`com.kline.woohyukmon`; never use this test certificate for store distribution.

No developer credential or production secret is supplied to this workflow.
Only native source, assets and the public API origin are compiled. K_LINE's
protected browser metadata and its production deployment are not modified.

## Current Functional Limit

The app backend is not deployed. A read-only GET of the production app events
endpoint returned HTTP 404 on 2026-10-07. Installing the preview tests native
startup, visual rendering and navigation; it does NOT establish that event
creation, native Google login, applications or memory photo upload work.
Do not distribute this build as a finished service.

## Android Test Installation

1. Download the `woohyukmon-android-arm64-TEST-ONLY-*` artifact from the successful
   GitHub Actions run and extract it. Verify its `apk-verification.json` hash.
2. Use an arm64 Android test device. The owner must choose whether to authorize
   installation from their browser/file manager. The agent does not change device
   security settings or bypass device warnings.
3. Open `app-release.apk`, install it, then launch `우혁몬(WOOHYUKMON)`.
4. Test all five tabs, Korean/English labels, accessibility text sizing, keyboard,
   background/restart behavior, and native safe areas. Record screenshots/results.
5. After isolated backend rollout, separately test native OAuth, role isolation,
   concurrent applications, AI drafting, permissions and private photo upload.

The template key is deliberately a disposable testing identity. Before adopting
the owner's final signing key, uninstall the test binary if Android reports an
incompatible signing certificate. This removes local app storage, not server-side
K_LINE accounts, club memberships or shared activity records. Get owner approval
before removing local app data.

Artifacts expire after three days; downloaded files can be retained by the owner.
No GitHub Release, Google Play listing or public consumer rollout is created by
this workflow. A successful artifact verification is not a physical-device test.

## iPhone and Stores

The owner has an iPhone but no USB connection and no confirmed paid Apple
Developer enrollment. The Mac currently has Command Line Tools only, not Xcode,
and no local Java/Android SDK. An iPhone IPA/TestFlight build requires the owner's
Apple signing/provisioning setup. Do not call an iOS JavaScript export or simulator
bundle an installable iPhone release.

The owner handles enrollment, identity verification, payments and binding terms:

- Apple: https://developer.apple.com/programs/enroll/
- Google Play: https://play.google.com/console/signup

New qualifying personal Play accounts require at least 12 testers continuously
opted into closed testing for 14 days before applying for production access:
https://support.google.com/googleplay/android-developer/answer/14151465

Once enrollment and staging functionality are complete, configure owner-controlled
EAS credentials, provision the iPhone, build an internal iOS preview, and verify
native login/photo/permissions on the actual device. Review the privacy/deletion,
moderation, equivalent-login and dependency-audit gates in `release-checkpoint.md`
before store submission. Never put Apple credentials, Google upload keys, AI keys
or Supabase service-role credentials into app source or public environment variables.

## Build Gate

From `mobile/woohyukmon`:

```sh
npm run release:check -- --platform=ios
npm run release:check -- --platform=android
```

This command fails until the corresponding evidence in `release-status.json` is
explicitly true. The `eas-build-pre-install` hook applies it to EAS `production`
builds. Internal preview builds remain available for testing. Updating a status
file without real evidence is not completion; this is a guardrail, not external
certification. Submission, approval and publication remain separate statuses.

## Primary Build Documentation

- https://docs.expo.dev/build-reference/apk/
- https://docs.expo.dev/guides/local-app-production/
- https://reactnative.dev/docs/signed-apk-android
- https://docs.github.com/en/actions/concepts/billing-and-usage
