# Developer Studio: ChatGPT Workspace Connections

## Scope and Release

Owner approved the additive production migration and this connection-only release on 2026-10-31. It does not migrate club tables, change existing lab keys, grant site roles, publish a project or import chat history. Existing owner/Yuki shared-workspace compatibility is preserved; all other users stay account-scoped. The owner can still inspect drafts and independently approve/release work.

## User Connection

In a ChatGPT account/workspace that supports custom MCP, add `https://kline-nine-wheat.vercel.app/api/co-development/mcp` with OAuth. Do not paste Codex TOML, `KLINE_LAB_TOKEN` or an OpenAI API key into this connection. ChatGPT discovers metadata, identifies/registers its client, generates S256 PKCE, then opens K_LINE login and explicit consent. Consent displays the signed-in account, client and callback. Verify with `lab_list`, save a bundle, and inspect the same project in K_LINE. File upload is context only.

Existing Codex bearer and private GPT Actions API-key paths remain supported. OAuth tokens are accepted only on MCP, never the browser command endpoint or Actions. There are no review, approval, deployment, repository, SQL or operational data tools.

## Protocol and Storage

- RFC 9728 resource discovery at `/.well-known/oauth-protected-resource/api/co-development/mcp` (also root fallback); unauthenticated MCP returns 401 with a `WWW-Authenticate` discovery challenge.
- RFC 8414 authorization server metadata at `/.well-known/oauth-authorization-server`. Issuer is the canonical origin; resource is the exact MCP URL. Production defaults to the existing K_LINE origin. An explicit `CO_DEVELOPMENT_OAUTH_ORIGIN` override must be an origin, use HTTPS except loopback, and match the request. Use an isolated DB for local/preview testing.
- Each MCP tool advertises the same `oauth2` / `lab:develop` policy at top level and under compatibility `_meta.securitySchemes`. Global unauthorized requests are rejected before any tool can read data.
- OpenAI CIMD URLs are fetched only on `https://chatgpt.com/oauth/.../client.json`, with redirects disabled, bounded reads and a timeout. The plural `token_endpoint_auth_methods_supported` intersection permits `none` even if the legacy singular preference is `private_key_jwt`. We do not claim to implement `private_key_jwt` or OIDC.
- DCR supports `none`, `client_secret_post`, `client_secret_basic`. Clients must register exact ChatGPT callback URLs; no arbitrary callback, wildcard redirect, URL credentials, query or fragment. Dynamic clients do not expire while in use. Registration is not a trust assertion; consent displays their supplied name and the real callback.
- Authorization code + S256 PKCE only. Exact redirect, client, issuer, resource and single `lab:develop` scope are bound. No implicit/password/client-credentials grant.
- Browser consent requires a verified existing K_LINE session, same-origin JSON POST and an HttpOnly SameSite nonce cookie; pending requests expire in 10 minutes. The consent page is not frameable. Approval/denial returns `state` and exact `iss`. Authorization codes expire after 2 minutes and are atomically consumed. Code replay revokes issued grant tokens.
- Access tokens expire in 1 hour. Refresh tokens rotate, expire after 30 days, and have replay detection that revokes the whole grant. Grants last at most 90 days. Individual connection revocation immediately invalidates all access/refresh tokens for that grant. Legacy lab keys are unaffected.
- Token, client-secret, code and nonce values are stored only as SHA-256 hashes. No bearer value is downloaded, displayed or logged. Fixed server-side RPC operations cannot address existing operating tables.
- Five new RLS-enabled tables: `co_dev_oauth_clients`, `co_dev_oauth_requests`, `co_dev_oauth_grants`, `co_dev_oauth_tokens`, `co_dev_oauth_limits`. One service-role-only, SECURITY INVOKER RPC `co_dev_oauth`. No anon/authenticated table/RPC grants. Limit counters are durable and atomic across instances. Expired pending requests/counters are cleaned lazily; grant/token audit rows are retained.

## Verification

`node --test scripts/co-development-oauth.test.mjs` runs the actual additive SQL in isolated PGlite, real API handlers, encrypted Auth.js fixture sessions and the official MCP SDK client. It covers discovery/DCR/CIMD fixtures, consent/CSRF, own-account binding, bundle creation, cross-tenant denial, no privileged tools, PKCE/resource/callback/client substitution, token rotation/replay/expiry/revocation, legacy-key preservation and database grants/RLS. All records are synthetic. CIMD network responses in this test are fixtures, not a real ChatGPT account linking claim.

Real ChatGPT linking still requires an eligible user's own settings and explicit consent after an approved HTTPS deployment and DB migration. A test SDK success must never be reported as a user's real ChatGPT account being connected.

Local checks on 2026-10-31: the OAuth suite passed 12 cases; 24 existing Developer Studio cases and 6 GKS permission/regression cases also passed. `npm run check` passed the full repository suite, production build and V4 isolation. Final targeted tests/typecheck/build are re-run after follow-up edits. Browser QA used an ordinary synthetic member, the connection panel and real nonce-bound consent page, including a 390px mobile viewport with no horizontal overflow. No external ChatGPT consent, production migration or deployment was performed.

Official references: https://developers.openai.com/plugins/build/auth and https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization .

## Guided First Run

`KLINE-GPT-START.md` and the ZIP's identical `START-HERE.md` now begin with a complete Korean/English start command and an assistant-facing checkpoint guide. Users can attach the file before setup or use Copy start command in the ChatGPT connection panel. Both are generated from the same origin-bound `setup-guide.ts`; they contain no credentials.

The requested assistant behavior is PREPARE → REGISTER → CONSENT → INSTALL → VERIFY → BUILD → REVIEW. It gives one next action/question at a time, follows the actual screen order, and resumes with a real `lab_list` call when tools are available. Registration, OAuth consent, installing the plugin and selecting it via @ are separate checkpoints. Users carry the file/command into a new tool-enabled chat if needed. No project is created until the user requests their first feature; the guide requires source/HTML save plus read-back and an actual user preview before owner-review instructions.

Missing tools, 401/403, account/workspace restrictions, localhost and a successful empty list are distinguished. The guide never asks for secrets, disables auth, claims installation from an attachment, or treats 'done' as a successful API call. The connected server instructions and `lab_starter` description point to the same guide. Tools, auth, database schema and review permissions are unchanged.

This is explicit guidance for the user's GPT, not programmatic control of ChatGPT settings or a guarantee that every model follows every instruction. Users must perform their own installation, login and consent. Validation checks the generated contract, route/ZIP consistency, native MCP instructions and the copy control's success state. The automation browser's virtual clipboard does not mirror navigator.clipboard, so an OS clipboard round-trip was not asserted. A real local browser download contained the full origin-bound, secret-free guide. No simulated assistant transcript is represented as a real end-user GPT setup.

## Approved Production Migration

The additive `co_development_oauth` migration was applied to the existing `okcabiimxuhhhokqajjg` project on 2026-10-31. A real DB query confirmed all five tables have RLS, anon/authenticated have no SELECT grants, and only service_role can execute the new SECURITY INVOKER RPC. Existing project/revision/legacy-key/record counts were unchanged. The full `npm run check` passed again before the release PR. External ChatGPT connection must still be confirmed by a user after deployment; no account connection is inferred from the isolated SDK tests.
