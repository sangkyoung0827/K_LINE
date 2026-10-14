# Conversational Club Operations

## Behavior

- General explanations, translation, writing and brainstorming use a natural reply path rather than being constrained to business-command JSON.
- Informal questions are interpreted using the current bounded conversation (up to 48 messages / 60,000 characters), not just the last twelve messages.
- Follow-up references reuse a previously named authorized club. A successful single-club operation returns that scope so the UI keeps the conversation on the correct club even when the page default differs.
- Missing essential targets get one focused question. Ordinary conversation does not require choosing a club. Low-risk reads use clear existing context; mutations never guess who or what to change.
- A malformed/incomplete plan gets one bounded repair attempt using the same provider/model. If it still fails, a tool-free natural reply explains available evidence or asks the next concrete question.
- Refusals are not retried or routed around. Authentication/quota/connection failures get honest next steps, not claims of completed work.
- Source failures do not produce fabricated files, counts or claims of successful reads.
- Current application counts are explicitly distinguished from lifetime attendance and unique historical participants.

## Security And Boundaries

History is untrusted context, not authorization or approval. Existing native route checks, source reauthorization, signed confirmations and replay prevention remain unchanged. The recovery reply has no tools and cannot execute writes or issue download tokens. Confirmation execution remains separate and is never replayed through conversational recovery.

OpenAI API access is not equivalent to every ChatGPT hosted tool. Native registered KLINE operations and source-based XLSX/DOCX exports are supported. Raw file uploads, OAuth, final Google Form review, source code/deployment changes and arbitrary external actions retain their existing boundaries.

No system can promise factual correctness or connectivity for every ambiguous request. The service must answer from verified evidence, clarify the genuinely missing detail, or state its limits instead of inventing results.

## Verification

- Isolated role, plan, recovery, export and confirmation suite: 24 tests.
- General assistant suite: 31 tests.
- Real OpenAI with isolated business fixtures: 10/10 scenarios passed (greeting, informal fee lookup, contextual XLSX export, English rewrite, club clarification, ambiguous target, source outage, unpublished notice draft, application-vs-attendance distinction, explicit fee-change preview).
- No production business writes, notices, forms, applications or documents were created by these tests.
- No database migration is needed for this extension.

Live evaluation command: node scripts/woohyukmon-dialogue-live-qa.mjs. It uses an approved existing local server key and isolated fixtures only; never commit that key.
