# K_LINE-wide Woohyukmon evidence retrieval

## Review Only

This change extends review PR #71. Do not merge or deploy without a new approval. No DB migration, role change, published notice, application, form or production document was created.

## Diagnosis

The administrator planner received only the selected/explicit club's closed capability catalog. The ordinary chat knowledge/site context was not supplied to this path. A question mentioning SIU therefore could exclude ECC tools even when the actor had ECC rights. The model could answer without gathering the site's available public records.

The reported recommendation is now tested verbatim. Site comparison/recommendation/search requests preload server evidence before planning, and a read-only `site_evidence` capability is available independently of the selected club. K_LINE-wide management tools still require their existing server-derived grants; an ordinary user cannot use another club's member tools.

## Retrieval Coverage

- Public: existing ECC activity catalog, approved ECC resources, published ECC board posts, Hanwhal introduction, published public non-sample research, upcoming public SIU events, existing public site references.
- Authorized operational context: anonymized ECC/Hanwhal registration counts, Hanwhal structured rounds/posts, SIU managed events, Jeju programs.
- Developer only: uploaded knowledge search through its existing developer API guard. This is a read-only search POST, not a material creation operation.
- Original native GET/knowledge-search handlers retain their authentication and ownership checks. No arbitrary SQL, URLs, imports, browser scripts, filesystem, secrets or privileged table access are accepted from the model.

The same source helper is connected to the administrator assistant, the streaming `/api/gemini` compatibility route (still OpenAI generation) and `/api/woohyukmon` chat.

## Evidence And Privacy

Only allowlisted content fields are returned. No member names, contacts, personal memories, raw application answers, submissions, signed file URLs or team chat links enter the site-comparison context. Application rows are aggregated server-side by activity; cancelled/rejected rows are excluded. Korean nationality aliases are normalized, and missing/unknown nationality is counted separately.

Counts are **returned application rows**, not unique people, historical attendance, satisfaction or a preference survey. Listing caps, displayed groups/records, pagination limits, source outages and denied access are explicit. Public SIU listing excludes past events by native design; an empty public list does not establish absence of historical records. Public static references are labelled as references, not verified research outcomes/participation evidence.

Reads are bounded by eight pages and an overall 20-second source deadline. The context budget trims text/groups with explicit displayed counts while retaining source availability and complete returned-row totals. Source texts remain untrusted. Mutation previews/confirmation, HMAC tokens, stale-source checks, receipt replay protection and existing DB/RLS are unchanged.

## Verification

- Club assistant tests: 31 passing (24 existing + seven source tests).
- General OpenAI/conversation tests: 31 passing.
- Research regressions: 16 passing.
- SIU platform regressions: 12 passing.
- ECC resource regressions: 20 passing.
- Type check, browser metadata safety and production build passed.
- Real OpenAI (`gpt-6-luna`) with isolated business fixtures: exact Korean prompt, ordinary account, source outage and English recommendation passed, with no business mutations.
- Production public GET checks: ECC catalog 7 records, ECC library 10 records, public research 0 records, public upcoming SIU listing 0 records. These are public listing snapshots, not lifetime participation/preference data.

Real-AI fixture results are stored outside the repo in `../outputs/woohyukmon-site-live-qa-20261014.json`. Their synthetic counts must never be reported as production statistics.

## Remaining Boundaries

This is scoped site retrieval, not an unconstrained browser or universal SQL agent. File contents beyond the supplied text/knowledge index are not automatically OCRed/extracted. Hidden/unauthorized rows, individual histories and preferences are not bulk-transmitted to AI. The legacy knowledge API can return an empty result on backend search failure, so its absence caveat is explicit. Not every table or club feature is connected to this comparison endpoint; the existing action registry remains the authority for supported operations.
