# Activity Notice Quality Audit

## Scope

Nine current presets and two first-time activities were inspected. The two new drafts used the live existing WooHyukmon API, not a mock provider. No Google forms, responses, publications, production records or deployments were created/changed. Only local audit artifacts were added.

## Results

| Case | Result |
| --- | --- |
| English Conversation Class | Korean/English application, activity time and warning sections match the supplied reference structure. |
| International Gathering | Bilingual recurring group/chat/application/cost rules present. Current date/time remains unspecified until supplied. |
| ECC General Activity | Generic description only; English activity description missing. |
| ECC OT | Generic description only; verified event-specific guidance missing. |
| ECC MT | Generic description only; verified event-specific guidance missing. |
| General K_LINE Activity | Generic description only; English activity description missing. |
| ECC Special Event | Generic description only; verified event-specific guidance missing. |
| ECC Farewell | Generic description only; verified event-specific guidance missing. |
| ECC Staff Recruitment | Generic description only; recruitment-specific guidance missing. |
| New tea tasting / traditional-pattern postcard activity | Live AI generated relevant name/tea-interest/pattern questions. Supplied date, deadline and venue preserved. Korean notice present; English activity description absent. |
| New urban sound walk, logistics undecided | Live AI generated four questions. Date, deadline and venue stayed empty, but the English notice contains only a heading. An activity-afterwards reflection question is inappropriate for an initial application form. |

## Cross-Cutting Findings

- All eleven generated notices kept application URLs/placeholders out of notice text.
- Novel activity descriptions are rendered only in the Korean section. The renderer does not translate them into English.
- Dates are presented as raw ISO strings rather than reader-friendly Korean/English dates.
- The AI prompt asks for a final optional requests question, but neither live draft included it; validation does not enforce that requirement.
- The urban sound walk's optional "activity afterthought (within 100 characters)" question requires post-event knowledge and should not appear on a pre-event application form. The 100-character constraint was not supplied by the operator.
- The renderer only has substantive approved recurring rule sets for Gathering and English Class. Other presets do not yet reach the reference notice's content quality.
- Mock-backed tests protect URL separation and safety behavior, not participant-facing completeness. All 33 existing Google Forms tests passed during this audit.

## Recommended Next Work

1. Define bilingual structured notice fields and require both language bodies before a notice is marked ready.
2. Retrieve verified event-specific guidance for existing presets; request missing logistics instead of treating generic descriptions as complete notices.
3. Review new AI questions for pre-event answerability and ensure a final optional requests question.
4. Format supplied dates for Korean/English readers while preserving timezone and original values.
5. Retest all presets plus multiple first-time activities before production deployment.

Raw generated drafts and notices: `google-forms-notice-audit-20261006.json`.
