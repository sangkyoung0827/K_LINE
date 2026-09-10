# ECC Official Outage Entry

Scope: automatic ECC permission-read retries and the explicitly approved,
self-declared-payment fallback for the `/ecc-official` lounge only.

- Normal negative results never enable the fallback.
- Transient role lookup failures retry twice, with a four-second deadline per
  attempt and short backoff. Configuration and authorization errors do not enable
  temporary entry.
- A logged-in user can declare payment only after the server independently
  rechecks the outage. A same-origin POST issues an HMAC-signed, HTTP-only cookie
  scoped to `/ecc-official`, bound to the login email and valid for 15 minutes.
- The lounge only accepts that cookie while its fresh lookup is still failing.
  Successful lookups always take precedence, including revoked/unapproved roles.
- Temporary entry does not modify payment, registration, membership, or admin
  records. Shared role resolution and activity APIs do not consume this cookie.
  Activity eligibility, closing times, board permissions, and admin features are
  unchanged. This is not a fallback authorization for activity applications.
- The outage assistant is a deterministic WooHyukmon-styled question, not an LLM
  permission decision. The unpaid response links to the existing registration
  instructions so bank and location details are not duplicated.
- Temporary visitors see a temporary-entry badge and a direct team-chat link;
  the protected QR endpoint remains unchanged. If operational settings cannot be
  loaded, only temporary entry uses the existing default team-chat settings.

This intentionally permits an unpaid logged-in user who falsely declares payment
to enter the lounge during an outage. The owner explicitly accepted that tradeoff.
It does not verify a payment and must never be described as confirmed membership.

No SQL migration or new secret is needed. Signing uses `AUTH_SECRET` (or
`NEXTAUTH_SECRET`). Missing signing configuration denies temporary entry.

Verification: `npm run test:ecc-approval-retry` includes the outage tests with
mocked reads and no production writes. Tests cover retries, deadlines, recovery,
negative results, configuration failures, guest access, token expiry/tampering,
account binding, same-origin enforcement, and the POST recheck.

Production deployment is not part of this local change. The full `npm run check`
currently stops at the existing collection-engine Playwright test because Chrome
cannot launch in this environment (SIGABRT/EPERM).
