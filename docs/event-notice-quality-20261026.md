# Event Notice Writing Quality

## Scope

Improve participant-facing Korean/English announcement writing in Event Studio. Keep the current OpenAI models, credentials, quotas, date grounding, form creation flow and publication controls unchanged. No existing notice is rewritten or republished.

## Observed Baseline

The real private ECC smoke test succeeded on 26 October, but its notice read like an administrative outline: a general introduction, a second generic activity summary, then "확정된 정보 / Confirmed details". The supplied 10/30/20-minute program was reduced to introductions, culture stories and reflections without its durations. The test warning also dominated the introduction.

## Changes

- Add a participant-notice editorial standard to the actual system prompt and identify its prompt version.
- Ask for a specific, welcoming introduction and readable mobile-chat paragraphs, not a report or exaggerated promotional copy.
- Preserve every supplied program step, order, duration and end time in both languages.
- Give clearly marked writing-technique excerpts, never invented source evidence or current event arrangements.
- Use verified recurring rules only for the corresponding activity. Unfamiliar activities may use concrete proposed actions, not unrelated ECC penalties or generic "meet, talk, finish" stages.
- Retain one short test warning without letting it replace the activity description.
- Keep application URLs separate, unknown logistics pending, and Korean/English facts equivalent.
- Carry the same writing requirements through bounded model retries. Do not replace model output with a hand-written notice.

## Validation

- `npm run test:event-studio`: 60 isolated tests passed (14 schedule/creation-flow tests and 46 backend/OAuth/health tests).
- Three added regression cases inspect the outbound prompt, preserve model/settings/output/schedule, check scope isolation for unfamiliar activities and keep editorial guidance during retry.
- `npm run check`: passed, including type checks, existing suites, browser metadata, production build and V4 isolation.
- The isolated tests use mocked AI/Google APIs and a local database. They do not prove improved live AI prose quality.
- No actual OpenAI comparison run, Google form creation, production record write, public release or policy/OAuth setting change was performed for this writing update at this checkpoint.

## Live Comparison Pending Approval

Compare three private, test-labelled cases: a known ECC Gathering, a first-time activity, and the previous supplied 10/30/20-minute program. Check the full Korean and English notices for specificity, exact supplied details, source isolation, no invented arrangements, natural phrasing and clean chat formatting. Do not manually edit generated output to pass review. Do not create Google forms or publish recruitment.

## Prompting Reference

The official OpenAI prompt-engineering guide describes separating instructions, examples and context, and using varied input/output examples to communicate the intended result: https://developers.openai.com/api/docs/guides/prompt-engineering . The new excerpts are labelled as writing technique, not factual evidence.
