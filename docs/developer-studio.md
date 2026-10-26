# Developer Studio: Local Implementation, 2026-10-27

## Actual Baseline

The original `/co-development` is working code, not only a design document. It already provides Google/NextAuth sessions, a shared owner/Yuki workspace, expiring hashed lab tokens, GPT Actions, native Streamable HTTP MCP, immutable HTML/source revisions, source ZIP download, custom workspace appearance, and project collection/state storage. It does not execute uploaded server source.

A read-only operational database audit found all existing `co_dev_*` tables with RLS and 17 invoker RPCs. The project/revision counts were zero at the time of audit; this is not a guarantee that no later work exists. No legacy project or operational data was deleted. Statements in `co-development-lab.md` describe its older two-account release, not this local implementation.

## Implemented Locally

- Any authenticated K_LINE account can enter Developer Studio. Projects, sources, revisions, settings and lab records are account-scoped. The original owner/Yuki shared space remains shared for compatibility.
- Users issue/revoke their own expiring lab connection key after login. Only its hash is stored. This key is not an OpenAI API key and cannot approve or publish services.
- GPT Actions can read/save HTML, source bundles, workspace appearance and project records. Codex uses the existing MCP tools and a key supplied through `bearer_token_env_var`. No production credentials are included in downloaded starters.
- Users build arbitrary self-contained frontend JavaScript/CSS/HTML locally with their own GPT/Codex, upload source and built HTML, run it, and persist project records. The workspace checks for externally saved versions every five seconds while visible and without unsaved local edits.
- A review request freezes a particular immutable revision. Owner review shows the submitted HTML, original source/hash, fixture, previous published HTML and an interactive preview with ephemeral test data.
- Owner session review can approve/reject with a required note. Publication is a separate explicit owner action; external GPT keys cannot invoke either operation.
- Only approved current revisions can be published to the home service cards and `/services/<project-id>`. Later author edits do not replace the published revision. Unpublish removes access without deleting history.
- Published runtime data is separate from development data and partitioned by authenticated visitor. Author fixtures/test records are never copied to public services. Concurrent writes require versions and return conflicts instead of silently overwriting.

## Isolation and Limits

The renderer is an opaque-origin `sandbox="allow-scripts"` iframe with restrictive CSP, blocked external fetch/form submission, and a MessagePort bound to the exact iframe. Its data bridge accepts only fixed collection/state operations. It receives no session cookie, repository token, server key, SQL or deployment capability. Owner review runs do not read/write the author's development records or visitor records.

This is browser code isolation, **not a microVM or a hard CPU/memory boundary**. Infinite-loop/resource exhaustion remains a browser risk. Uploaded Node/Python/server files are stored for review but never executed on the host. Do not describe server execution as implemented. Arbitrary package installation, external integrations, shared multi-user service datasets and custom backend execution need a separately approved isolated runtime and permission model. The current per-visitor data model does not implement a shared club database.

Source input rejects recognizable lab/OpenAI keys and private-key blocks, but pattern detection is not comprehensive secret scanning. Source/code review is still necessary. Public JavaScript can access its own application's visitor partition through the SDK; owner review must assess application behavior, not just appearance.

No generic shell, arbitrary SQL, remote repository write, operational club/member access, owner decision or deployment tool is exposed to external GPTs. New DB tables use RLS and deny browser roles; narrowly allowlisted server RPCs are the only data path. Existing operational club/auth/form tables are not changed by this migration.

## Verification

- `npm run test:co-development`: 22 tests pass against local PGlite SQL plus real route handlers, encrypted test sessions and native MCP SDK client.
- Tenant separation covers project listing, IDs, revisions, source, state, collections, settings, GPT tokens and forged actor fields.
- Owner-only review/release, submitted snapshot integrity, stale approvals, rejection, explicit publication, pinned live versions, unpublish and visitor data separation pass.
- The additive migration runs twice locally, preserves legacy rows and denies browser table/function/internal-RPC access.
- `npm run check` passed, including TypeScript, production build and existing regression suites. No remote CI was started for this unpushed branch.
- Browser: ordinary member authored a travel-task app, created/completed a record, submitted it; owner inspected and approved it; a separate publication action created a home card. The public app persisted its own record across reload. Another visitor saw zero records. Review preview started empty, not with author data.
- Local browser evidence: `../artifacts/developer-studio-20261027/` in the parent workspace. Test identities exist only in the localhost fixture server, never application authentication.
- No real personal GPT account or remote HTTPS connection was tested against the new version. Protocol integration tests do not establish a user's actual GPT/Codex configuration.
- A requested 390px browser viewport override did not take effect (observed DOM width stayed 1616px). Desktop screenshots and English controls were checked; do not report the viewport attempt as a completed mobile visual check.

## Operational Readiness

The implementation was first verified locally on `feature/developer-studio-20261027`, without a push, operational migration or deployment. On 2026-10-27 the owner separately authorized releasing Developer Studio, exposing its card irrespective of role, and removing only the Woohyukmon home card. The release keeps Google login for account-bound work and leaves existing chat launchers, club features, browser metadata and operational club data unchanged. Deployment results belong in the release PR. Local preview: `http://localhost:3375/co-development` (in-memory test DB; restarting clears fixture projects).

Required separate owner approval before operational changes:

1. Review this branch, the additive `supabase/migrations/20261026174659_developer_studio.sql`, and the browser-runtime limitations.
2. Back up the current lab tables; inspect concurrent Yuki work; apply only this migration to an approved test database first. Run security advisors and real Postgres verification. PGlite is not the production database.
3. Establish a protected HTTPS validation deployment, verify owner/member/Yuki accounts and personal GPT Actions/Codex connections, then review remote CI.
4. Decide on a separately isolated server runtime if arbitrary backend execution is required. Do not turn on host execution as a shortcut.
5. Only after final owner approval publish the application change. Individual user services still require their own owner review and explicit card publication.

## Official Connection References

- GPT Actions authentication and OpenAPI: https://developers.openai.com/api/docs/actions/getting-started
- Codex Streamable HTTP MCP bearer environment configuration: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

ChatGPT's remote MCP OAuth is not implemented by this change. A GPT share URL is not an authentication credential, and connecting does not import a user's chat history.
