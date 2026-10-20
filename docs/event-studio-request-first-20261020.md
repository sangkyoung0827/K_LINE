# Event Studio: Request-First Drafting

## Reported Failure

The old loopback preview returned a fixed Hanhwal fixture for arbitrary prompts.
Its refinement fixture contained a different date/venue than the user's answers,
so grounding correctly rejected it. That preview was not evidence of live AI
generation quality. The production planner also demanded explicit years and
timezones, and replaced known activity notices with a canned source template.

## Changes

- Treat the user's institution, country, activity and audience as the task.
- Supply relevant public KLINE activity records as optional inspiration; retain
  existing authorization for private archive references and managed club data.
- Do not overwrite model-written notices with source templates.
- Show a copyable notice before asking for missing operational information.
- Use one input for the initial request and follow-up changes, plus a new-event action.
- Resolve natural dates with Chrono and Temporal, not model-created timestamps.
- Show timezone, approximate periods and end-of-day deadline assumptions for review.
- Preserve the planning reference instant across refinements. Conflicting or
  ambiguous dates remain unconfirmed; never move an event to fit a deadline.
- Validate explicit calendar dates in participant copy against resolved fields.
- Keep the explicit approval boundary before any external Google mutation.

## Local Verification Boundaries

`npm run test:event-studio` tests actual services against isolated PGlite and mocked
provider responses. Model output fixtures prove contracts, not live writing quality.
The German university regression resolves 20 November 2026 at 19:00 in Berlin,
30 October at 23:59:59 in Berlin, and 50 participants. The event remains personal.
Coverage also includes relative dates, approximate periods, year rollover,
summer/winter offsets, nonexistent/repeated DST times, authorization and idempotency.

The default `scripts/event-studio-personal-preview.mjs` is UI-only: AI is disabled,
no fixture is substituted for an arbitrary prompt, and Google operations are blocked.
After providing a server-only `OPENAI_API_KEY` through a private environment file,
explicitly opt in to real AI with:

```sh
WOOHYUKMON_PREVIEW_OPENAI_ENABLED=true node --env-file=/absolute/private/local.env scripts/event-studio-personal-preview.mjs --live-ai
```

This mode can incur OpenAI API charges. It uses a fresh local DB, performs no
production DB reads/writes, and blocks Google creation and recruitment publication.
No real AI or Google verification was performed during local validation.
The owner subsequently authorized production release on 20 October 2026, using
the existing `studymap4yous-projects/kline` project and canonical KLINE domain.
Release requires the reviewed personal/Hanhwal namespace migration and passing CI.
No Google form creation or recruitment publication is part of this release.
Do not report completion of live end-to-end verification until the real provider
response is inspected.

Local verification passed: `npm run check` (including production build), 40 event/
OAuth tests, four natural-schedule tests, and actual loopback HTTP checks confirming
that unconnected AI never returns a fixture and Google creation remains blocked.
