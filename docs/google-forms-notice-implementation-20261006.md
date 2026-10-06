# Source-backed activity announcements

## Sources and boundaries

- Read the READY ECC_OFFICIAL_ACTIVITY_NOTICES_2026-09-14.md knowledge document and the current ECC activity catalog without updating either.
- Curated only participant-facing International Gathering facts; English Conversation Class rules use the owner's 2026-10-06 reference notice.
- Do not reuse historical event dates, bank accounts, member conversations or personal records.
- OT, MT, special events, farewell and staff recruitment currently have only generic descriptions. Their specific logistics and rules require administrator confirmation.
- This implementation does not train model weights or automatically incorporate future knowledge uploads. The curated source module is versioned application data.

## Changes

- Existing notices have Korean and English sections, activity-specific verified rules and readable Korea-time dates.
- Novel activities use the existing WooHyukmon API, requiring both Korean and English introductions.
- Common unsupported preparation, experience, free-admission, equipment and city claims are excluded when not supplied by the operator. These checks are guardrails, not comprehensive factual verification; the approval preview remains mandatory.
- New-activity application questions cannot request post-event reflections; KakaoTalk name and a final optional requests question are retained.
- Application URLs stay separate from notice copy. Internal review/debug lines are removed.
- Optional bilingual fields live in the existing workflow draft JSON; no SQL migration or existing member-data writes.

## Verification

- Google Forms suite: 35/35 passed.
- Typecheck and production build passed.
- Browser metadata safety passed; git diff --check passed.
- Nine presets audited; two novel activities generated through the real existing API. Final outputs are in google-forms-notice-verified-20261006.json.
- A previous live request temporarily failed upstream; a later content audit succeeded for both novel activities. Do not interpret content verification as a provider availability guarantee.
- In-app browser: preview loads, activity selection works, Korean/English text and separate URL field render, no console errors. At 390px there is no horizontal overflow.
- In-app browser clipboard readback did not confirm copying; no clipboard-success claim is made.
- Full npm test was attempted but could not finish because its unrelated headless Chrome launch was blocked in this environment (SIGABRT / EPERM). It is not a fully passing regression run.
- No Google form creation, response submission, publication, production deployment or member-data changes were performed by the announcement audit.

Preview: http://127.0.0.1:3324/?noticePreview=source-backed
