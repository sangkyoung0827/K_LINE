# Live Response Validation, 2026-10-15

## Evidence Boundaries

- The local calm-progress fixture on port 3361 returns synthetic text for every prompt. It is UI-only, not evidence of an OpenAI call or live site retrieval.
- The existing public deployment was tested with the authenticated ECC management account. A recommendation-only question returned a concrete proposed activity, source paths and current registration totals. Read-only aggregate SQL independently matched the returned activity counts. No event, notice or application form was created.
- The original short event-planning prompt instead requested confirmation for `event_plan`. That action was cancelled without executing it. Recommendation-only testing must not approve a write preview.
- A lesson file's existence is not evidence of positive feedback. Source limitations now explicitly prohibit that inference.
- This live result applies to the existing public code, not the new PR's streaming UI. Do not describe it as an end-to-end pass for the new build.

## Regression Fix

The evidence predicate recognized Korean words for activities/programs but not the common Korean loanword for event. A short ECC event-planning request could therefore skip evidence preloading. The predicate now recognizes that wording and planning intent. Focused tests verify preloading, read-only access, removal of private fields and exclusion of unrelated conversation/member-list queries.

## Release Gate

- Stage the exact reviewed commit with existing production bindings and `--prod --skip-domain`.
- Preserve SSO protection and the existing public domain assignment. Do not merge or promote as part of private verification.
- Verify real answers on that build before release. Confirm source numbers, unknown dates/capacity, authorization boundaries and completion/cleanup of the progress line.
- Preview bindings do not contain the required AI/database/auth configuration. An ordinary preview is insufficient for this validation.
- At this checkpoint, staging is blocked by the expired Vercel CLI login. The browser is signed into a different Vercel account without K_LINE access. The project-owning account must authenticate; do not copy keys, forge application sessions or disable deployment protection to work around this.
- The focused assistant suite passes (33 tests). The full local check reaches browser tests that cannot launch Chrome in the sandbox; it is not an all-green check. The production build passes separately. Require fresh CI on the final commit and record its result before any merge.

No schema, RLS, OAuth provider or public deployment settings were changed for this validation.
