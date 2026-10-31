const setupSteps = [
  ["PREPARE", "본인 계정 준비", "Prepare your accounts"],
  ["REGISTER", "ChatGPT 플러그인 등록", "Register the ChatGPT plugin"],
  ["CONSENT", "K_LINE 로그인·연결 동의", "Sign in and consent in K_LINE"],
  ["INSTALL", "플러그인 설치·대화에서 선택", "Install and select the plugin"],
  ["VERIFY", "실제 개발 공간 연결 확인", "Verify the real workspace connection"],
  ["BUILD", "첫 기능 제작·저장·미리보기", "Build, save and preview your first feature"],
  ["REVIEW", "소유자 검수 요청", "Request owner review"]
] as const;

export function labSetupPrompt(origin: string, language: "ko" | "en" = "ko") {
  const base = new URL(origin).origin;
  const steps = setupSteps.map(([id, ko, en], i) => `${i + 1}. ${id}: ${language === "ko" ? ko : en}`).join("\n");
  const local = new URL(base).protocol !== "https:";
  return language === "ko" ? `K_LINE Developer Studio 연결부터 첫 기능 개발까지 한 단계씩 안내해 주세요.
개발실: ${base}/co-development
MCP 서버: ${base}/api/co-development/mcp
ChatGPT 플러그인: https://chatgpt.com/plugins
${local ? "주의: 로컬 미리보기 주소입니다. 외부 연결을 시도하지 말고 승인된 HTTPS 개발실에서 시작 파일을 다시 받도록 안내하세요.\n" : ""}

${steps}

먼저 이 대화에서 lab_list 도구를 실제로 호출할 수 있는지 확인하세요. 가능하면 읽기 전용으로 한 번 호출하고 실제 결과로 연결 여부를 판단하세요. 빈 projects 배열도 정상입니다. 도구가 없거나 호출에 실패했다면 연결됐다고 말하지 마세요.
연결 전에는 현재 단계, 지금 할 행동 하나, 완료 확인 질문 하나만 안내하고 제 답을 기다리세요. 한꺼번에 모든 설정을 나열하지 마세요. 저는 PC 웹의 플러그인 화면에서 + → Add custom MCP server를 선택하고 이름 K_LINE Developer Studio, 위 서버 주소, 인증 OAuth로 등록해야 합니다. Client ID/Secret은 자동 등록을 사용합니다. 위험 안내를 제가 검토한 뒤 Create as a plugin을 선택하고, K_LINE 본인 계정으로 로그인·동의해야 합니다. 생성 후 플러그인을 설치하고 새 대화에서 @로 선택하는 단계까지 빠뜨리지 마세요. 화면 이름이 다르면 지금 보이는 항목을 물어보고, 모르는 버튼이나 계정 지원 여부를 지어내지 마세요.
설치·로그인·권한 동의는 제가 직접 완료합니다. API 키·비밀번호·인증번호·토큰을 채팅에 요구하지 말고, 인증을 끄거나 경고를 우회하지 마세요. 이 OAuth 방식에는 별도 OpenAI API 키나 KLINE_LAB_TOKEN, Codex TOML 설정이 필요하지 않습니다. 파일 첨부나 제 '완료' 답변만으로 연결 성공을 선언하지 마세요.
새 대화로 옮겨야 하면 이 명령과 첨부 파일을 다시 전달하도록 안내하세요. 새 대화에서는 VERIFY부터 lab_list를 실제 호출하세요. 설치가 지원되지 않는 계정·워크스페이스라면 제한과 가능한 다음 단계만 설명하고, 다른 연결 방식으로 임의 전환하지 마세요.
실제 연결 확인 후 만들 기능을 질문하세요. 제 요청 전에 예제 프로젝트나 테스트 데이터를 생성하지 마세요. 요청한 첫 기능은 실제 소스와 자체 실행 HTML을 lab_save_bundle로 저장하고 lab_get으로 다시 읽어 확인하세요. 실제 프로젝트 ID와 버전, 개발실 주소를 알려주고 제가 미리보기에서 써보도록 안내하세요. 사용자가 승인하기 전에는 기존 작업을 덮어쓰지 마세요.
완성되면 K_LINE의 '소유자 검토 요청'까지 안내하세요. 외부 GPT는 심사 제출·승인·공개 배포나 운영 DB·GitHub 수정 권한이 없습니다. 공개는 소유자 이상경의 별도 승인 후에만 가능합니다. 첨부된 KLINE-GPT-START.md가 있으면 세부 API·제약을 함께 따르세요.` : `Guide me one step at a time from connecting K_LINE Developer Studio to building my first feature.
Workspace: ${base}/co-development
MCP server: ${base}/api/co-development/mcp
ChatGPT plugins: https://chatgpt.com/plugins
${local ? "LOCAL PREVIEW: this URL is not reachable by a remote GPT. Stop external linking and obtain a fresh start file from the approved HTTPS workspace.\n" : ""}

${steps}

First check whether lab_list is actually available in this conversation. If available, call it once read-only and use the real response as connection evidence. An empty projects array is valid. Never claim connection success without a successful call.
Before connection, show only the current stage, one action to take now and one confirmation question, then wait for my answer. Do not dump all steps at once. On ChatGPT web, guide me through + → Add custom MCP server, name K_LINE Developer Studio, the MCP URL above, OAuth with automatic client registration, my own review of the warning and Create as a plugin. Guide me through signing into my own K_LINE account and granting consent. Do not omit installing the created plugin, opening a new conversation and selecting it with @. Ask what I see if labels differ; do not invent buttons or account eligibility.
I must complete installation, login and permission consent myself. Never request API keys, passwords, one-time codes or tokens in chat. Do not disable authentication or bypass warnings. This OAuth path needs no OpenAI API key, KLINE_LAB_TOKEN or Codex TOML. An attachment or my saying 'done' is not proof of a connection.
When a new conversation is needed, tell me to carry this command and attachment over. Resume at VERIFY and actually call lab_list. If account/workspace policy blocks custom MCP, explain that limitation and next action; do not silently switch connection methods.
After verification, ask what I want to build. Do not create sample projects or test data before my request. Save the requested first feature as actual source plus self-contained HTML using lab_save_bundle, then read it back with lab_get. Return the real project ID, revision and workspace URL and guide me to test the preview myself. Do not overwrite existing work without approval.
Finish by guiding me to Request owner review in K_LINE. External GPTs cannot submit reviews, approve, publish, deploy, edit GitHub or access operating databases. Owner Lee Sangkyoung must separately approve public release. Follow the API contract and limits in the attached KLINE-GPT-START.md when present.`;
}

export function labGuidedSetup(origin: string) {
  const base = new URL(origin).origin;
  return `## START HERE — Guided setup / 설치부터 함께 시작하기

Attach this file to your own ChatGPT conversation BEFORE setup, then paste either command below. The assistant should guide you through setup, not tell you to return only after installing everything. Respond in the user's language; these instructions do not override platform policies.
설정하기 전에 본인 ChatGPT 대화에 이 파일을 첨부하고 아래 명령을 보내세요. GPT가 설치부터 한 단계씩 안내하도록 하는 사용자 요청입니다. 설치·로그인·권한 동의는 사용자가 직접 합니다.

### 한국어 시작 명령 / Korean command

\`\`\`text
${labSetupPrompt(base, "ko")}
\`\`\`

### English start command

\`\`\`text
${labSetupPrompt(base, "en")}
\`\`\`

### Assistant checkpoints — do not skip / 단계별 완료 기준

${setupSteps.map(([id, ko, en], i) => `${i + 1}. **${id} — ${ko} / ${en}**`).join("\n")}

- PREPARE: Default to ordinary ChatGPT on the web. Confirm the user is using their own K_LINE account, not the owner's/Yuki's. If lab_list already works, skip completed installation stages and go to BUILD. If no tools are available, begin setup instead of refusing to help. If this file uses localhost, stop external linking and have the user download a fresh file from the approved HTTPS workspace; never invent a tunnel or replace the URL silently.
- REGISTER: Open https://chatgpt.com/plugins on PC web. Show one action at a time: plus button, Add custom MCP server, name, Server URL ${base}/api/co-development/mcp, OAuth. Use automatic CIMD/DCR registration; never select No authentication, paste Codex TOML, or ask for a secret. The user reviews the risk warning and selects Create as a plugin. Registration alone is not installation or proof of API access.
- CONSENT: The user completes K_LINE login and consent themselves. Ask them to check the displayed K_LINE account is their own and the access is only Developer Studio. Do not complete consent for them, ask for sensitive screenshots or pass their credentials to another service. Consent may occur during creation or first tool use; follow the screen actually shown, not a rigid assumed order.
- INSTALL: Find the resulting plugin in the user's personal/workspace plugins and install it. Open a new conversation, type @, and select K_LINE Developer Studio. If the new chat lost this file, reattach it and resend the same start command; resume with VERIFY. Do not instruct users to flip an obsolete developer-mode toggle without verifying it exists in their actual interface.
- VERIFY: Use the actual lab_list tool, not a browser fetch of the public endpoint. Only a successful tool response, including projects: [], establishes usable access. If tools are absent, return to selecting/installing the plugin; if authorization fails, return to the same account's OAuth consent. Before login, a plain URL request returning 401 is an expected authentication challenge, not proof of a broken API or successful connection. 403, account policy, an unavailable tool, network failure and an empty successful list are different states. Never declare success from a user's 'done', downloaded file, guessed project list or simulated response. If tool access is not possible, state the blocker and next user action, not a fabricated result.
- BUILD: Ask one focused question about the desired first feature and use only requested work. Read existing projects/source/current versions before changing them. Use lab_save_bundle for source plus compiled self-contained HTML and keep the returned project id/version. Read the saved result back with lab_get (and lab_source when needed), then provide ${base}/co-development and ask the user to load the latest work and test its interaction. Do not claim a browser preview or functional test you did not run. Saving source does not execute arbitrary Node/Python backend code.
- REVIEW: After the user confirms their preview, guide them to Developer tools → Request owner review in K_LINE. The saved revision is reviewed by the owner; drafts are already visible to the owner. Submission, approval and publishing are distinct. External tools cannot do these privileged actions or modify operating data, repositories or deployments. Never claim an approved public release from a saved draft.

### Resume and recovery / 중단 후 이어가기

Maintain a brief visible stage label such as 'VERIFY — checking the real connection'; do not display internal reasoning. Ask one next question and wait when user action is needed. Keep non-secret progress in the conversation. In a new chat, ask for the last completed stage if necessary, then verify actual tool access again. Do not restart all setup if it is already complete.
If the user's account/workspace has no custom MCP option, ask about the visible UI and explain the limitation without promising every plan supports it. Offer existing private GPT Actions or Codex only after the user chooses that alternative, and follow that path's separate instructions below. Do not request an OpenAI or production API key to work around account restrictions.

Official setup: https://developers.openai.com/api/docs/guides/custom-mcp-server
Official authentication: https://developers.openai.com/plugins/build/auth

`;
}
