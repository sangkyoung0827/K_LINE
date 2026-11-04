# WOOHYUKMON native development checkpoint

Independent Expo / React Native iOS and Android app, not a WebView of K_LINE.
This is an unfinished development checkpoint, not an installable store release.
A separate GitHub Actions workflow builds an Android arm64 test APK with embedded
JavaScript and disposable template signing; see
`../../docs/woohyukmon-1/installable-preview.md`. Its backend is not yet deployed.
An APK artifact is not proof of native-device testing or store publication.

## Local commands

Use the SDK-compatible Node version (22.13+). Install this project's dependencies
separately from the root Next.js app.

```sh
npm ci
npm run typecheck
npm run test:release
npx expo install --check
npm run export
npm run prebuild
npm start
```

`expo export` creates JavaScript/Hermes bundles, not a signed IPA or AAB.
`expo prebuild --no-install` generates native projects but does not compile them.
Full Xcode/Android SDK or user-owned EAS build setup is still required.

Copy `.env.example` to a local ignored env file and set only the public API origin.
Never put AI, Google client-secret or Supabase service-role keys in an Expo env
variable, app config, client bundle or EAS public build variable.

Use the app on a native build for authentication: existing K_LINE browser login
returns a one-use PKCE-bound code to `woohyukmon://auth`. The native opaque session
is stored in OS SecureStore. Browser preview intentionally does not persist tokens
or claim to validate native authentication.

The initial API origin is the existing K_LINE domain. New API routes are disabled
unless explicitly enabled on a validated backend. Until backend rollout, retry/error
states are expected. The preview does not insert synthetic events into real data.

## Native assets

The square eyeglasses app icon is a newly generated bitmap in `assets/icon.png`,
not an edit to K_LINE's protected browser icons. Source size is 1254 x 1254;
Expo's native asset pipeline generates the required platform icon sizes.
Prompt: a single clear pair of thick graphite eyeglasses with restrained teal
temples on opaque white, centered, no face, text, gradient, outer mask or shadow.
Splash uses the same source on white. Final brand approval is pending.

## Submission

See `../../docs/woohyukmon-1/release-checkpoint.md` for requirements and gaps.
Bundle/package `com.kline.woohyukmon` is provisional until the owner registers it.
No EAS project, developer account or signing identity has been created by the agent.
No cloud build, store payment, contract acceptance or review submission was made.
Store EAS production builds now run a fail-closed evidence check before dependency
installation. Run `npm run release:check -- --platform=ios` (or `android`) to see
the outstanding requirements. This guard does not enable any production API.
