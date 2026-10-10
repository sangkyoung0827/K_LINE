# Event Notice Source Quality

## Scope

Fix notice generation only. Native applications, membership/payment permissions,
existing saved notices, Google OAuth and production data are not migrated or removed.
No database migration is required.

## Root Cause

The Google Forms tab kept the default ECC general template even when the title
identified International Gathering. Its notice introduction was a single generic
application sentence. Event Studio also received truncated reference text.

## Changes

- Resolve recognized ECC titles only when the selected template is generic.
  Explicit non-generic templates and other clubs are preserved.
- Repair newly rendered legacy generic drafts without mutating their saved data.
- Supply curated, participant-facing Gathering and English Class knowledge.
  Sources: owner-approved ECC official notices dated 2026-09-14 and the owner's
  English Conversation Class screenshot supplied on 2026-10-06.
- Compose recognized activity notices with verified recurring rules and supplied
  logistics, excluding historic event dates, venues, payment instructions and fees.
- For unrecognized activities, request concrete proposed steps, participant guidance
  and confirmed/pending logistics in both languages. Do not reuse ECC penalties.
- Validate generated notices for generic one-line output, proposal labeling,
  unsupported eligibility/material promises, unrelated rules and copy-ready text.
  Retry within the existing three-attempt limit and persistent quotas.
- Keep application links separate and administrator approval mandatory.

Detailed MT, Special Event, Farewell and other current operational facts are not
asserted where the reviewed notice source does not supply them. New programs are
proposals, not fabricated past activities or confirmed operating arrangements.

## Validation

- Event Studio: 21 tests, including source repair, generic output retry, source scope,
  unsupported claims, permissions, approval/replay, failure recovery and quotas.
- Google Forms: 52 tests, including the exact default-template/title reproduction,
  aliases, explicit templates, other clubs and non-mutation of saved drafts.
- Typecheck, production build and V4 isolation verified locally.
- Desktop and 390px mobile UI checked through the in-app browser: correct Gathering
  rules, separate URL field, no horizontal overflow.
- Live OpenAI audit: Gathering, English Class, international meditation,
  tea/postcard exchange and hanbok-color photo stories. All DB/Google operations
  isolated; no Google forms or production records created by the audit.
- Local full check and headless UI test encounter macOS browser-launch sandbox
  restrictions in existing Chromium tests. The required Browser Safety CI must pass
  before merge; this limitation is not treated as a passing local full test.

## Reproducing The Live Audit

Use an existing approved server-only env file; never pass a key as a CLI argument.

```sh
EVENT_NOTICE_LIVE_AUDIT=true \
EVENT_NOTICE_AUDIT_ENV=/absolute/path/to/server-only.env \
EVENT_NOTICE_AUDIT_OUTPUT=/private/tmp/event-notice-audit.json \
node scripts/event-studio-notice-audit.mjs
```

Output contains generated plans and safe metadata, not credentials or response bodies
from failed API calls. Read and review generated notices before approving a real event.
Saved old notices are not bulk-rewritten; regenerate or explicitly edit them.
