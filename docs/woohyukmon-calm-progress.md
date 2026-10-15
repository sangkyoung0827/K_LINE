# Woohyukmon Calm Progress

This change is stacked on the web Memory Book handoff PR. Both remain review-only.

## Behavior

- One short, localized progress line replaces accumulating technical status badges and duplicate waiting messages in GlobalWoohyukmon and WoohyukmonChatbot.
- The line follows actual client request / confirmation calls and server workflow events. The site-source event is emitted before the existing authorized source lookup.
- Real answer chunks still appear as they arrive. No artificial typewriter delay, replayed internal reasoning, guessed tool history, raw model/provider diagnostic label or additional AI call is introduced.
- The progress line disappears when the request finishes, including failures. Model verification and heartbeat events cannot replace a meaningful workflow phase.
- Existing authorization, confirmations, retrieval boundaries, response content, document downloads and saved-chat behavior are unchanged. No database migration or credentials change.
- Spinner use is restrained: logos stay still, while the active progress line has one small reduced-motion-aware indicator.

## Verification

- Progress mapping and UI tests cover Korean/English, unknown diagnostics/prototype property names, one status region, inactive removal and authorized source event ordering.
- Existing isolated send-handler tests still cover member guide and admin routing; request/confirmation guards are unchanged.
- `npm run check` was attempted. As in the handoff PR, the local full run reaches the existing Chrome-based traditional-liquor collection test and stops at a sandbox SIGABRT/EPERM launch failure. Do not describe this as a full local check pass.
- Build/type checking and the focused Woohyukmon suites passed locally; Browser Safety CI must pass before any merge.
- A local HTTP fixture serves the real optimized frontend while intercepting every API request. It returns clearly labeled synthetic response text and never forwards API calls to production, Supabase or an AI provider.
- In-app browser inspection verified one active line, source-check to answer-preparation to writing transitions, partial response rendering, no visible diagnostic labels, no horizontal overflow and removal on completion.
- The fixture delay is test-only. It is not included in application code or production configuration.

## Limits

This is a workflow-status UI, not a display of private chain-of-thought. JSON-only management calls show a general checking / approved-action phase; detailed live per-tool steps would require a separate authenticated streaming protocol. No real AI generation-quality claim is made from fixture testing. The standalone app still needs its own release/build and physical-device checks.
