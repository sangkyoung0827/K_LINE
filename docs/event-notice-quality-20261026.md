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
- After live inspection found a contradictory application-link denial, distinguish venue access links from separately handled application links. Reject claims that an application link does not exist or will not be provided, while allowing unpublished-link notices.

## Validation

- Final `npm run test:event-studio`: 61 isolated tests passed (14 schedule/creation-flow tests and 47 backend/OAuth/health tests).
- Four added regression cases inspect the outbound prompt, preserve model/settings/output/schedule, check scope isolation for unfamiliar activities, retain guidance during retry and fail closed for an unapproved/keyless audit. Existing quality tests also cover link-denial versus venue/publication wording.
- `npm run check`: passed, including type checks, existing suites, browser metadata, production build and V4 isolation.
- The isolated tests use mocked AI/Google APIs and a local database. They do not prove improved live AI prose quality.
- This was the pre-approval checkpoint. The approved actual OpenAI comparison is documented below. There was no Google form creation, production record write, public release or policy/OAuth setting change for this writing update.

## Approved Live Comparison

- The owner approved three private, test-labelled AI notice cases, with no forms, recruitment or public-domain assignment.
- Used the existing studymap `kline` project and production server bindings with `vercel deploy --prod --skip-domain`. The protected non-canonical deployment uses the server key internally; no API key was retrieved, printed, changed or copied into local configuration.
- The validation-only build runner executes `generateEventPlan` through the existing harness with live OpenAI, mocked Google and a local PGlite store. Its strict fetch boundary does not permit production DB or real Google requests. No application auth/session was forged and no HTTP audit endpoint was added.
- First run: `dpl_3sZQq7GV8ZF2b29SMcNsDwRp2ymh`, READY, no aliases. Structured checks passed, but human review found an unsupported "No application link will be provided" claim. This was not counted as a clean quality pass. The prompt and validator were corrected and the same inputs regenerated, not manually edited.
- Final run: `dpl_7qH8k6tyK5cwfTUA64zv8ysrTaES`, READY, no aliases. All three final cases passed: Gathering, novel meditation and the original supplied 10/30/20-minute itinerary. Meditation used one bounded retry; the other cases used none.
- Final AI source blob: `4783a6e3ed3dc0546c798f153a0f9186cba009ce`. The staged app source includes the PR #88 writing change plus the live-found link-claim correction; it is not an unchanged copy of the initial PR head.
- Gathering retains weekly grouping, day-before group chats and application deadline, individual activity costs and the verified no-show rule. No date, venue or capacity was invented.
- Novel meditation is explicitly a proposed program, with concrete participant actions and pending logistics. It does not inherit Gathering penalties or grouping rules. It still needs organizer review of actual audience, conditions and safety before real recruitment; a good draft is not a confirmed operating plan.
- The supplied itinerary preserves the 10/30/20-minute steps, 18:00~19:00 KST, actual supplied deadline, venue, capacity 3 and free fee in both notices. Name is required and expectations optional. Venue access-link absence is kept separate from application-link guidance.
- Final notices contain no URL and do not claim that the separately handled application link cannot be provided. Original provider output was not rewritten to obtain a pass.
- Actual output records were retrieved in small log chunks and verified against their recorded SHA-256 hashes. Files: `artifacts/notice-quality-20261026/actual-ai-results.json` and `actual-ai-notices.md` (local evidence, not public website content).
- Final audit summary: 3/3 passed, real Google writes 0, production database writes 0. This proves actual AI generation, not Google form creation or applicant-submission E2E.
- Existing public deployment remained `dpl_4EjdWSL6na6focxvgcYYVe5oEh6L`, commit `9b62709599be7744aec45f79d2af7e13299483d3`, while staged builds ran. Project SSO protects non-custom deployment URLs; an anonymous final-stage probe returned 302. No protection was disabled.
- Local `vercel.json`, `.vercelignore` and `.vercel/project.json` are validation-only configuration and are not part of the PR. The normal public build command and project settings were not changed.
- The audit scripts require explicit approval flags and a server key. A preflight test verifies fail-closed behavior without making external requests. They never run automatically in a normal `npm run build`.
- Public merge/release remains subject to separate owner approval after reviewing the actual notices.

## Prompting Reference

The official OpenAI prompt-engineering guide describes separating instructions, examples and context, and using varied input/output examples to communicate the intended result: https://developers.openai.com/api/docs/guides/prompt-engineering . The new excerpts are labelled as writing technique, not factual evidence.
