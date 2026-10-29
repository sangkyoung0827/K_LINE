import { labActionSchema } from "./schema";

export function labOnboarding(origin: string) {
  const base = new URL(origin).origin;
  const local = new URL(base).protocol !== "https:";
  return `# K_LINE Developer Studio — GPT / Codex Start File

## Read this first / 먼저 읽기

This file contains the actual connection contract, capabilities and workflow. It contains NO key.
이 파일에는 연결 방법과 실제 지원 기능이 들어 있습니다. 비밀키는 포함하지 않습니다.
Attaching a file to an ordinary ChatGPT conversation does not install tools or grant API access. Configure a private GPT Action or Codex MCP once, then attach this file and start developing.
일반 채팅에 파일만 첨부해도 API가 연결되는 것은 아닙니다. 개인 GPT Actions 또는 Codex MCP를 최초 1회 설정해야 합니다.
${local ? "LOCAL PREVIEW: this localhost address is not reachable by a remote GPT. Obtain this file again from the approved public HTTPS Developer Studio before external connection.\n로컬 미리보기 주소입니다. 외부 GPT 연결에는 운영 HTTPS 사이트에서 다시 받은 파일을 사용하세요.\n" : ""}
Workspace: ${base}/co-development
Actions endpoint: ${base}/api/co-development/actions
Codex MCP: ${base}/api/co-development/mcp
Owner / 최종 승인자: K_LINE owner Lee Sangkyoung (이상경).

## 1. The only credential you need / 필요한 연결키

Sign in to K_LINE with YOUR OWN Google account. Open Development connection and issue your own Developer Studio connection key. It starts with kll_. Each user must use their own key; do not share the owner's or Yuki's key. Rotating revokes that account's previous key. Keys expire and can be revoked from the same screen.
본인의 K_LINE 계정으로 로그인해 개인 연결키를 발급하세요. 다른 사람의 키를 공유하지 마세요. 갱신하면 기존 키가 무효화됩니다.

This is NOT an OpenAI API key. Never use an sk- key, Supabase service key, GitHub token or Vercel token here. No production key is necessary. A user's separate ChatGPT/Codex access and any plan restrictions still apply.
이 키는 OpenAI API 키가 아닙니다. 운영 서버 키는 전달하지 않습니다.
Put the key only in the Action authentication field or the local KLINE_LAB_TOKEN environment variable. Do not paste it into chats, attachments, source, fixtures, logs, screenshots, public GPTs or URLs.
키는 인증 설정에만 입력하고 채팅·첨부파일·소스코드에 넣지 마세요. GPT는 비공개로 유지하세요.

## 2A. Personal GPT / 개인 GPT

1. Create or edit your PRIVATE GPT. Open Configure → Actions → Create new action.
2. Copy the complete JSON in the OpenAPI section below into Schema. Alternatively download openapi.json from the same Developer Studio connection panel.
3. Authentication: API Key → Bearer. Enter YOUR lab-issued key in that authentication field, then save.
4. Test operation coDevelopment with {"action":"list"}. A real empty projects list is a successful connection; a text-only claim is not.
5. Attach this file and say: "Read this file, verify the connection with list, then help me build my project."

Schema import and key entry are user-controlled setup steps. If Actions or the destination domain is unavailable under your plan/workspace policy, report that limitation. Do not claim file upload alone connects the API. A Custom GPT share URL is not a credential. This file does not import private chat history.
스키마와 키 입력은 사용자가 직접 해야 합니다. 계정에서 Actions를 사용할 수 없다면 Codex 경로를 사용하세요. 연결되지 않았는데 연결됐다고 말하지 마세요.

## 2B. Codex

Download the development project ZIP from this workspace and open it in your own Codex. Read its AGENTS.md and README.md. Add this trusted MCP configuration, keeping the key outside source:

\`\`\`toml
[mcp_servers.kline_lab]
url = "${base}/api/co-development/mcp"
bearer_token_env_var = "KLINE_LAB_TOKEN"
\`\`\`

Set KLINE_LAB_TOKEN in the environment that actually starts Codex, restart/reload its MCP connection, and call lab_list. Do not echo the key. A .env file is not automatically the Codex launch environment. Do not edit global configuration without the user's approval. The ZIP has local build/sync scripts, an empty project and this guide; Node.js 20.19+ is required for those scripts.

## 3. Instructions for the connected coding assistant

- First make a real list / lab_list call. On 401/403 ask the user to check key expiry/configuration; never request a secret in chat. Without tool access, explain the missing setup and stop claiming saves happened.
- Ask what the user wants to build. They may design their own club-like card, website and interactive features; this is not a fixed template editor. Build an actual usable interface, not an explanation page.
- Before editing use get / lab_get. For source use source_get / lab_source with the returned revision id. Preserve existing user work and current versions.
- Compile CSS, JavaScript and assets into one self-contained HTML file. No external fetch, CDN, remote imports, cookies, localStorage or native form navigation can be assumed in the sandbox. Use click/keydown handlers with the runtime SDK.
- Save real source AND built HTML using bundle_save / lab_save_bundle. New projects use a generated UUID and expectedRevision 0. Keep that id for retries. Existing saves require the actual current expectedRevision. On 409 reload and reconcile; never blindly overwrite.
- Limits: HTML 256 KiB; up to 100 text source files, 1 MiB total; fixture 64 KiB; 100 projects/account and 100 versions/project; rate limits apply. Never include credentials or real personal data. Backend source can be archived, but uploaded Node/Python/server code is NOT executed by K_LINE. No arbitrary host shell, package installation or custom server runtime is exposed.
- For test data use records_list / lab_records and record_save / lab_save_record. Collection names match ^[a-z][a-z0-9_-]{0,39}$. Pass projectId, collection, a UUID id, data and expectedVersion (0 to create). Read every page using nextCursor. Record limit: 500/project, 16 KiB/record. Archive/restore is reversible; no permanent delete. Records persist across UI revisions.
- Workspace/card design uses settings_get / lab_settings then settings_save / lab_customize with the full appearance and current expectedVersion. Only this workspace changes; no ECC/Hanhwal card or production data can be altered. The legacy owner/Yuki shared workspace remains shared; other members are account-scoped.
- Every saved project and source revision can be inspected by the K_LINE owner for review, including drafts. This is an owner-reviewed development space, not storage for secrets. Other ordinary users cannot access your projects.
- After saving return the real project id, saved version and workspace link. Ask the user to open/reload the preview and test interactions. Do not invent a successful screenshot, test, save, submission or deployment.
- On completion have the user click Request owner review in Developer tools. This freezes the exact saved revision. External GPT keys cannot submit, approve, publish, change permissions, modify the operational repository or deploy. The owner inspects code/source and an isolated preview, approves or rejects, then separately chooses Publish card. New edits never silently replace a published version.

## Runtime SDK reference

The sandbox injects window.KLINE_LAB. Use it only after it is available. No runtime key is exposed.

\`\`\`js
const current = await window.KLINE_LAB.read(); // { data, version }
await window.KLINE_LAB.save({ ...current.data, count: 1 }, current.version);
const page = await window.KLINE_LAB.records.list("tasks", { limit: 50 });
// page: { records, nextCursor }; use after: page.nextCursor for the next page
const record = await window.KLINE_LAB.records.save("tasks", crypto.randomUUID(), { title: "Synthetic task" }, 0);
await window.KLINE_LAB.records.save("tasks", record.id, record.data, record.version, true); // archive
\`\`\`

Review previews use ephemeral test data, not author/live data. Published service records are isolated per signed-in visitor; this is not a shared production club database. New external services, payments, Google or shared multi-user backends require separate owner-approved integration.

## OpenAPI — copy the complete JSON into GPT Actions

\`\`\`json
${JSON.stringify(labActionSchema(base),null,2)}
\`\`\`

## Official setup references

- https://developers.openai.com/api/docs/actions/getting-started
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli
`;
}
