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

ChatGPT remote MCP now has an additive OAuth implementation described below. A GPT share URL is not an authentication credential, and connecting does not import a user's chat history.

## GPT Start File and Owner Oversight (2026-10-29, Local)

- Authenticated users download `KLINE-GPT-START.md` directly from the workspace header or connection dialog. The generated file includes English/Korean setup instructions, the exact origin-bound OpenAPI schema, Codex MCP config, SDK examples, limits and the owner-review workflow. The source ZIP also contains `START-HERE.md` and `openapi.json`. The existing starter API/MCP tools are reused; no new GPT privilege is introduced.
- File attachment is context, not authentication or tool installation. Users can choose ChatGPT OAuth, private GPT Actions with a lab-issued key, or Codex MCP with a local bearer environment variable. Downloads contain no key; the local-origin guide warns that a remote GPT cannot reach localhost. Account/plan/domain restrictions still apply. The user's own ChatGPT settings and final K_LINE consent remain manual.
- The owner now has a paginated inventory of all accounts' saved lab projects, including unsubmitted drafts, and can inspect any immutable source/HTML revision in a sandbox. The source remains account-scoped for other users. The new oversight reads are fixed server-side GET queries against only `co_dev_projects`, `co_dev_revisions` and `co_dev_sources`, checked for the exact owner session before credentials or data are accessed. No author runtime records, token table, operational club tables or new SQL function are exposed. Existing service-role SELECT grants suffice; no migration is required.
- Owner draft preview uses the same restricted CSP and opaque-origin iframe as review preview, and an ephemeral data bridge: inspecting/testing cannot mutate author records or public-service data. Creating a new draft does not request review or publish it automatically. Human review submission pins the revision, and the existing explicit owner approval and separate publication action remain required. The review button is also available outside the expanded developer tools.
- The workspace and guide disclose owner visibility of saved drafts/source. External GPT keys, including an owner's key, cannot access oversight, review decisions or publication. No changes to Yuki's saved data or any existing public service are performed by this feature.
- Validation: 24 isolated route/PGlite/native-MCP tests passed, including guide/schema/ZIP authentication, no-key output, correct origin, owner draft/source inspection, cross-tenant/key denial, immutable old versions and separate approval/publication. TypeScript passed. Real local browser: an ordinary fixture member saved a draft; owner inventory found it before review submission; the owner preview ran an SDK record operation with ephemeral data. No real personal GPT account or external HTTPS connection was used by these local tests.
- Changes are local pending separate release approval. S.V.K. localization work in the same checkout is unrelated and must not be included in a Developer Studio-only release. No operational DB/schema changes, token issuance, remote push or deployment have been performed for this revision.
- Final `npm run check` passed, including the complete regression suite, production build and V4 isolation check. The first sandboxed attempt stopped at tsx's temporary IPC permission; rerunning with local IPC permission completed successfully. Existing workspace-root/Node localStorage warnings remain. The source ZIP and attachable guide are generated under the parent workspace's `artifacts/developer-studio-start-20261029/`. The local owner UI verified draft oversight, ephemeral record creation, unchanged author data and a subsequent human review request. No production publication was tested or performed.

## Approved Release Scope (2026-10-30)

The owner authorized releasing only the start file, connection guidance and owner oversight to the existing K_LINE Developer Studio. The release branch is based on production main after PR #92. It contains no S.V.K. files, global language changes, sample projects, artifacts, migrations, credential changes or public-service publication. The existing owner review and separate service-card publication gates remain unchanged. Deployment and post-release read-only verification results belong in the release PR and handoff.
