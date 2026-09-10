# Read-only co-developer

Account: `noritakeyuki@fuji.waseda.jp` (Yuki Noritake).

This is developer **view** access, not a writable developer account. It is always
included alongside the existing configured owner accounts; those accounts retain
their previous access. No membership, payment, or organization records are changed.

## Enforcement

- Middleware verifies the existing Auth.js encrypted session (including chunked
  cookies) before recognizing the viewer. Client-supplied email/role headers and
  form fields are not used as identity.
- GET/HEAD/OPTIONS navigation and data reads remain available with the existing
  developer visibility checks. All other HTTP methods are rejected before route
  handlers, including API writes and page POST/server-action requests.
- Existing `/api/auth` exclusion remains for Google login and logout only.
- A middleware-owned request marker additionally prevents Supabase writes from
  read handlers that perform lazy initialization. Client-supplied markers are
  stripped and cannot disable this guard.
- UI shows a read-only notice. ECC registration content and team-chat link/QR
  editing are disabled for this account. Other developer panels remain visible
  for inspection, but their mutation requests are denied by the server.
- Uploads, imports, collector execution, AI operation requests, membership
  approvals, deletions and settings saves are not permitted. This is not a
  sandbox with writable test data and does not grant GitHub/Vercel access.

The allowlist is in `src/lib/readOnlyDeveloper.ts`; removing the account there
revokes view access without changing the existing writable developer list.
No SQL migration or shared credentials are required. The user signs in with
their own Google account; no new account or credentials are created by this change.

## Verification

`scripts/read-only-developer.test.mjs` tests real test-key-encrypted session
tokens, developer visibility, owner preservation, write rejection, header
spoofing, cookie chunking, bearer sessions and nested DB-write denial. Tests use
only mocked DB dependencies and never impersonate a production session.
