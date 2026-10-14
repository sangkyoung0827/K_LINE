# Google / K_LINE account linkage checkpoint (2026-10-07)

## Implemented

- Web login no longer throws `NATIVE_LOGIN_REQUIRED`. It navigates to the new
  `/api/woohyukmon-app/v1/auth/web` route, which reuses existing K_LINE NextAuth
  Google sign-in, account registration policy and HttpOnly cookies.
- The web client uses same-origin cookie requests, not localStorage/sessionStorage
  tokens or cross-origin credential forwarding. Native PKCE/SecureStore is unchanged.
- `/auth/session` maps the authenticated, normalized email to the existing active
  `site_members` ID. It does not write memberships, payments or club roles.
- Profile reads can be enabled separately with `WOOHYUKMON_APP_WEB_AUTH_ENABLED`;
  this does not enable unfinished event APIs or require production schema changes.
  When the event engine is enabled, its deletion/session restrictions still apply.
- Sign-out validates same origin and signs out the shared K_LINE web session.
- Login always returns to a validated, server-configured local path. Request query
  parameters cannot redirect tokens or the user to an arbitrary external origin.
- Explicit nested tab routes preserve the My screen on reload. The profile shows
  the connected K_LINE account and its own email, not another member's data.

## Live verification and its limits

The owner completed Google sign-in in the local browser. The preview displayed
the existing member name/email; reload retained the connection and My tab. A
390 x 844 screenshot is saved in the private workspace output folder, not Git.

This uses `scripts/woohyukmon-app-auth-preview.mjs`, an explicitly local-only
Google OIDC adapter with the existing **test** OAuth client and registered
localhost callback, plus the real read-only Supabase identity lookup and production
profile-route code. It is NOT a deployed NextAuth/native-device test. The adapter
requests only `openid email profile`; no Forms/Drive scopes, refresh tokens,
membership changes, new accounts, role changes or production migrations.

The former private ECC participant preview on port 3300 was stopped so the existing
registered callback could be reused. No production site was stopped. Other form
development servers were left alone. The stopped preview's already-created test
form was not deleted or modified by this checkpoint.

## Reproduction

From the repository, install root/native dependencies and export the native project.
Supply the existing test OAuth client JSON path to:

```sh
node scripts/woohyukmon-app-auth-preview.mjs /absolute/path/to/test-client.json
```

The script requires ignored `private/supabase-server.local.json` credentials,
binds only loopback ports 8097/3300, rejects unexpected Host headers and explicitly
requires the existing test project/callback. Keep these files out of Git. Google
state is cookie-bound, PKCE is used, flows are one-use/10-minute and preview
sessions are HttpOnly/one-hour/in-memory. Restarting the process requires sign-in
again. Do not deploy this adapter as the production login server.

## Remaining before rollout

- Serve the web export from the K_LINE API origin at the configured return path
  (`/woohyukmon/Main/My` by default), or adjust it to the actual same-origin host.
  The current native feature branch does not deploy this static web path.
- Enable the separate auth flag only in an approved environment and verify real
  NextAuth callback, shared sign-out, expiry and website account identity there.
- Native login still needs the reviewed app migrations, explicit backend enabling,
  signed builds and physical iPhone/Android PKCE/SecureStore tests.

No production environment variables, Google Cloud settings, legacy auth source,
legacy database tables or K_LINE club permissions were changed. Store-release
status flags remain false.

## Validation

- Root and native typechecks: pass.
- Root production build and V4 isolation check: pass. The local build also reports
  inherited workspace-root and JOSE Edge runtime warnings; neither was hidden.
- Existing app pure-model tests: 4 pass.
- New web auth test plus the existing app DB/isolation suite: 11 pass. Coverage
  includes default-off, anonymous identity, normalized existing member lookup,
  inactive/missing identity, fixed return path, malicious redirects and logout CSRF.
- iOS/Android/web JavaScript exports: pass, not signed/device builds.
- The full local `npm run check` again reaches the existing Chrome collection
  test but fails because the sandbox cannot launch Chrome (EPERM/SIGABRT).
  Its legacy pretest suites passed; CI is still required before any merge.
- The login commit does not modify either lockfile. Its native CI found newly
  recommended Expo patches, so the follow-up updates only the native package and
  lockfile: Expo 57.0.27, constants 57.0.21 and image-manipulator 57.0.21.
  SDK compatibility and native typecheck pass after these patches. Root audit
  reports 19 existing findings (5 moderate, 11 high, 3 critical) across the inherited
  web dependency tree; native audit after the patches reports 23 (8 moderate,
  15 high). These are
  release gates, not claimed repaired. Review compatible upstream patches and
  actual reachability before enabling production auth or submitting store builds;
  do not run forced major-version downgrades during this scoped login change.

Relevant upstream advisories:
- https://github.com/advisories/GHSA-x445-f3h2-j279
- https://github.com/advisories/GHSA-2xp9-vwfh-vxw4

The OAuth provider-confusion advisory requires multiple providers/account linking;
K_LINE currently has one Google provider. This does not clear other audit findings.

Official references:
- https://authjs.dev/getting-started/session-management/get-session
- https://docs.expo.dev/guides/authentication/

## Source preservation

During finalization, unrelated baseline files/dependencies were removed from the
temporary checkout by an external change. Those removals were neither reverted
nor included. Only the nine login-related edited/new files were mechanically
copied into the intact, already saved workspace checkpoint. Final documentation,
validation and commit are performed in that intact checkout.
