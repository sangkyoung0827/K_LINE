# Woohyukmon Execution Plan Diagnosis

## Reported Failure

User prompt: ECC에서 international gathering 지금까지 누적 참여자가 몇명인지 알려주세요.

The deployed message "실행 계획을 만들지 못했습니다. 요청 범위를 구체적으로 알려주세요." is emitted only when JSON parsing or object conversion of a generated plan fails. It is not an insufficient-detail validation message and does not establish a permission failure.

## What Is Known

- Verified deployed commit: 46e2ccae7b38bd1a6ffc47216e73b766c124ede0.
- The same question was exercised through real gpt-6-luna calls with isolated club/business sources, including multi-club developer grants, no selected scope, and two prior-conversation variants. All three returned an answer without this error. No production data was queried or changed by these reproductions.
- Vercel's recent runtime log query returned no records. The handler did not log this caught parse failure, and OpenAI requests use store:false. The exact failed response therefore cannot be recovered from available evidence. Do not claim one specific provider response caused the screenshot.

## Reproduced Code Defects

1. The generator concatenated all output_text parts, including commentary before final_answer. Commentary followed by valid JSON caused the reported parser exception.
2. A provider refusal was converted to an ordinary string without an explicit refusal marker. The planner attempted to parse that string as JSON and produced the same misleading message.

The OpenAI documentation distinguishes commentary/final_answer and explicitly notes that refusals need not match the requested structured schema:

- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses

## Correction

- Structured plans select the final answer, not commentary. Commentary-only results are incomplete, not successful plans.
- Any refusal remains a refusal; no alternate model, retry or privileged operation bypasses it.
- Invalid JSON and incomplete responses have separate diagnostic codes and accurate messages, rather than blaming the user's prompt.
- Logs contain diagnostic codes and model identifiers only. Prompts, model body text, personal data, cookies and credentials are not logged.
- Existing role checks, signed confirmations and native API handlers are unchanged.

## Verification And Release State

- Both defects first failed regression tests on the old implementation.
- Fixed general assistant tests: 31/31 pass.
- Fixed isolated club tests: 18/18 pass.
- Type checking passes.
- Production release has not been changed by this investigation. The correction is stored on a review branch.

## Separate Metric Limitation

The existing ECC applications GET reads current ecc_activity_applications rows and computes application counts. It is not a verified lifetime attendance/unique-participant history source. A current application count must not be presented as all-time actual participation. This limitation is separate from the JSON parse failure; it is not evidence that the user's question was too vague.
