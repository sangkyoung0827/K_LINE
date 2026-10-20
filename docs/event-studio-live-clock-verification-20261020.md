# Live Verification: Local Event Clocks

## Evidence

A real personal Google OAuth round-trip returned to the same saved event.
One natural-language follow-up triggered real OpenAI generation and a real,
unpublished Google Form plus private notice. No recruitment was opened.

The original form displayed 20 November 2026 at 12:00 Europe/Berlin, while the
user requested 19:00. The notice mentioned an internal resolved-schedule
disagreement. This is a failed quality check, not a completed end-to-end pass.
The generated Google original and notice were not manually corrected.

## Root Cause And Fix

Chrono split `2026년 11월 20일 독일 현지 저녁 7시입니다` into a date result and a
separate explicit clock. The old adapter selected the first result and used its
implied noon because the overall sentence contained a clock. Combine the date
with the single explicit clock; reject ranges, multiple dates, multiple clocks
and unparsed clocks rather than substitute defaults. IANA/DST handling stays.

Validate the local calendar day and clock in BOTH notices against structured
event/deadline fields before Google creation. Mismatch and parser commentary
trigger full model regeneration, never output patching. Known regression cases
now contain matching mock notice times so their original assertions stay useful.

## Scope

No database migration, key change, Google scope change, published notice or
recruitment state change. Preserve the first failed test original as evidence.
Production release and a new from-scratch live test require the owner's approval.
Do not report the new live test passed until its real Google original is read.
