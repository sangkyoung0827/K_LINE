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

- Event Studio backend: 29 tests passed, including follow-up scope checks,
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

## Remaining Live Gates

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
