# ECC MT Validation - 2026-10-18

## Actual Production Attempt

Entered this request through the authenticated Woohyukmon tab at
`https://kline-nine-wheat.vercel.app/admin/google-forms`:

> ECC MT 신청자를 받는 구글폼과 한국어·영어 공지를 만들어 주세요. 기존 우혁몬의 ECC MT 자료를 참고하되, 이번 행사에 필요한 정보가 부족하면 저에게 먼저 질문해 주세요.

The real OpenAI call completed using `gpt-6-luna`, with prompt version
`event-studio-1.1-source-notices`. It saved draft job
`dbbf6419-ba82-42b1-b461-8c8dc8d0586d` at revision 1.

This attempt did NOT pass quality review:

- Missing information appeared as internal field names, not conversational questions.
- Notices and descriptions included organizer-only draft/system commentary.
- The proposed MT program was generic and the application had only a name question.
- Date, deadline, venue and capacity were unknown. Approval was disabled.

No Google form, notice publication or response was created by this attempt.
The stored draft was left unchanged as evidence, not edited into a passing result.
A read-only query of ready knowledge-file chunks for MT/엠티 returned no matches;
this is not a claim that every other historical source was exhaustively searched.

## System Corrections

- Both manager entry points now use the Event Studio planning and approval service.
  The template tab no longer immediately creates a generic legacy preset form.
  Legacy APIs and native club applications remain available and unchanged.
- Missing logistics produce bilingual conversational questions, including MT fee,
  overnight/end-time, program and transport prompts when basics are missing.
- Follow-up answers regenerate the entire plan from server-saved user requests.
  AI proposals never become confirmed logistical evidence. Generation failure
  preserves the previous draft; a compare-and-swap revision prevents stale writes.
- Participant copy containing draft/system commentary is rejected and retried as
  a complete AI generation. The failed output is not edited into a successful one.
- Old jobs without saved user input require a fresh request for conversational
  planning, rather than treating their generated text as user-confirmed facts.

No new database migration is required for these corrections. User request turns
are stored in the existing private job metadata, with email/identifier redaction.
The previous readiness migrations and release gates are documented separately in
`google-forms-automation-readiness.md`.

## Isolated Verification

- Event Studio backend: 31 tests passed, including follow-up scope checks,
  stale revisions, failure preservation, whole-generation quality retries,
  original Google-content verification and idempotent creation.
- Forms manager desktop/mobile fixture: passed. Both entry points reach the
  same review flow; missing facts block approval; the mobile question/answer
  screen has no horizontal overflow. Mock applicant names still render correctly.
- Full `npm run check`: passed, including regression tests, type checks,
  browser metadata validation, production build and V4 isolation. Browser tests
  needed execution outside the macOS process sandbox; their initial sandbox
  launch failure was not an application failure or a passed test.
- These fixtures do NOT certify a real Google response submission or live AI
  output quality after the correction.

## Initial Live Gates (Superseded by Operator Approval Below)

The operator has been asked for current MT logistics or permission to use clearly
marked test-only logistics, and for permission to deploy the reviewed code.
Neither an unknown date nor an invented venue should be used for actual recruitment.

After those answers, restart from the original natural-language request on the
corrected server. Independently repeat through the Google Forms template tab.
For both generated originals, verify bilingual content, confirmed logistics,
appropriate minimal questions, separate notice/link output and private notice
storage. Then submit clearly marked non-sensitive test answers through the real
Google responder interface, sync through K_LINE, compare the actual Google and
K_LINE counts/names, repeat sync for duplicate safety, and close test reception.
Do not announce the end-to-end test as complete until these real steps succeed.

No policy publication, OAuth production transition, scheduler activation or
public recruitment notice is authorized by this validation record.

## Operator Follow-Up and Further Corrections

The operator authorized a 50-person test with fictional logistics, and asked for
the program to reflect ECC material. They explicitly requested PR-only storage,
not production deployment or merge. The test uses 24 October 2026, 13:00-18:00 KST,
a clearly fictional ECC exchange venue, a 23 October 18:00 KST deadline, and a
fictional zero fee with no supplied meals, transport or materials.

The current ECC catalog describes MT only as an ECC MT application; no detailed
historical MT itinerary was found. The system therefore uses the existing ECC
cultural-exchange introduction as inspiration, not MT operating rules. Culture
quiz, cross-cultural role-play and collaborative storytelling are proposals,
not claims about an established ECC MT itinerary.

Real OpenAI audits exposed further quality issues: ISO timestamps in participant
copy, descriptions duplicating full notices, omitted test labels/timezones, and
a validation false positive treating "materials are not provided" as a provision
promise. The system prompt and semantic checks were corrected, then generation
was restarted. One real UI planning call had a transport failure before any form
existed; transport failures now retry once within the three-call budget, without
upgrading models or retrying authentication/quota/refusal failures.

Local server validation uses the same application components, planning service,
Google API client and response routes, with real OpenAI/Google and local Postgres.
It is NOT verification of production Next.js login or live Supabase persistence.
The Google connection is reauthorized for the same existing scopes, stored only
in the isolated local DB. No production Google connection is replaced.

The first real Google attempt created form
`1U2mkICEO_2ekOwuJ8VB1zpbjHNoEcnNOzkyzpxWTdJ4` and received two real test responses.
Google and the local applicant screen both showed the same two test names;
repeated synchronization kept two records. The close request closed Google but
then exposed a local validation adapter bug: raw PGlite Date objects were passed
where the real service receives JSON timestamps. The adapter was fixed; the
Google responder page was independently checked to show reception closed. This
partial attempt is preserved, not certified as the final passing run. A fresh
full run follows the fix, rather than editing its generated content or records.

## Fresh Final Run: Natural-Language Entry

The corrected adapter was restarted with a fresh isolated database and the same
Google test account was reconnected. The initial natural-language request asked
for an ECC MT form and bilingual notice for 50 people. The interface asked for
missing logistics before approval; the operator's fictional test logistics were
supplied as a follow-up. No generated field or remote Google content was edited.

- Job: `0631eb9b-9fef-4862-8419-5aa662e486d6`, revision 2.
- Model: `gpt-6-luna`; prompt: `event-studio-1.3-mt-participant-copy`.
- Google form: `1NLdzkmByP-TquOniXX21Dci9tF8TuW_wps7QL5LyIvk`.
- Local registry: `f6ffd1c0-5838-4f97-8a7b-9630492fc1a9`.
- Original: https://docs.google.com/forms/d/1NLdzkmByP-TquOniXX21Dci9tF8TuW_wps7QL5LyIvk/edit
- Google UI showed capacity 50, the confirmed test dates/venue, a required name
  question and an optional program-preference question. Email collection was off.
- Two actual responder submissions: `연동검증 자연어 A` and `연동검증 자연어 B`.
  Google Responses and the application both showed these same two names.
- Repeated synchronization retained exactly two records; the names-only dialog
  generated a bilingual team-assignment notice without exposing raw answers.
- The close action succeeded in both the local registry (`closed`) and Google:
  the actual responder page stated that responses were no longer accepted.
- Bilingual event notice and application URL appeared in separate copy fields.

The generated program contains three distinct proposed activities: mixed-team
culture quiz, cross-cultural situation role-play and cooperative storytelling.
These are ECC-inspired proposals, not recovered historical MT schedules. The
notice is explicitly fictional and has not been posted to a club or chatroom.

## Template-Path Timeout and Restart

The independent Google Forms-tab attempt reached the missing-information
questions, but both transport attempts for its refinement expired under the
old 45-second request limit. The original draft and user input were preserved;
no second remote form was created. The full report is retained separately from
the new run, including the successful natural-language form above.

The system now allows up to 65 seconds per AI request with a shared 145-second
AI deadline, inside the existing 160-second client and 180-second route limits.
Timeouts are distinguished from other transport failures, retry at most once,
do not upgrade the model, and have a specific preserved-input error message.
Quota/authentication failures are still terminal. A deterministic regression
tests the shared deadline and bounded timeout recovery without sleeping.
This follows the bounded-attempt and total-deadline guidance in the
[official OpenAI retry documentation](https://developers.openai.com/api/docs/guides/rate-limits).

The affected template path is restarted from a fresh isolated database and
original title request, not by editing its generated plan or remote content.

## Final Template-Path Result

The fresh Google Forms-tab request selected ECC MT and entered only a test title
with capacity 50. Missing logistics were asked conversationally; the same test
logistics were supplied as a follow-up. Both real AI calls completed using
`gpt-6-luna`, with no retry or model upgrade in this fresh run.

- Job: `f3495984-0702-4517-9722-679f5a2af51f`, revision 2.
- Google form: `1ANr92Y6sXyIRj6G2WqvkyyObS3ANPeKiqjhxAwA-HvI`.
- Local registry: `a32027f2-0c51-4f7e-9d8f-ee14e069872c`.
- Original: https://docs.google.com/forms/d/1ANr92Y6sXyIRj6G2WqvkyyObS3ANPeKiqjhxAwA-HvI/edit
- Original Google content showed capacity 50 and the same confirmed test date,
  deadline and venue. Questions were required name and optional single-choice
  program preference, including a no-preference option. Email collection was off.
- Submitted `연동검증 템플릿 A` through the actual Google responder interface.
  Google Responses and the application both showed exactly one response and
  that same name. A second synchronization still showed one unique record.
- The names-only grouping dialog generated its team-assignment notice.
- Close succeeded in the registry and the actual Google responder page; the
  Google editor also showed that responses were no longer being accepted.
- No generated notice, question or original Google form was manually changed.

## Final Scope and Evidence

The two passing forms contain three real test submissions in total. Both are
closed; their notices remain private local drafts, not published club notices.
The earlier partial form is also closed and retained as failure evidence, not
counted as a passing run. No production member/application data was changed.

The final raw evidence files are saved outside Git in the workspace `outputs/`:

- `ecc-mt-live-google-final-20261018.json`: natural-language success and the
  preserved subsequent failed template attempt under the old time limit.
- `ecc-mt-template-google-final-20261018.json`: fresh passing template attempt.
- `ecc-mt-verification-summary-20261018.json`: asserted counts, model and IDs.
- `ecc-mt-natural-language-notice-20261018.txt` and
  `ecc-mt-google-forms-notice-20261018.txt`: exact generated copy-field bodies.
  Their application URLs are exported separately. The raw private storage
  evidence still retains the original body plus its application-link footer.

Full `npm run check` and desktop/mobile Forms UI regression passed again after
the timeout change. The actual compact in-app-browser grouping screen was also
visually checked without horizontal overflow. Its measured viewport was 664px;
the 390x844 mobile check is the separate automated UI fixture, not a claim about
an actual phone test or a successful 390px in-app-browser override.

This is real OpenAI and real Google service validation with local PGlite
persistence. Production Next.js login, production Supabase persistence and a
deployed version of this code have NOT been validated by these runs. These
remain release gates after review; the code is stored only in PR #77. No merge,
production deployment, OAuth production transition, policy publication,
scheduler activation or actual ECC recruitment has been performed.
