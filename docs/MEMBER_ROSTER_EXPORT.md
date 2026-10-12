# Club Member Roster Export

## Scope

- ECC and Hanhwal registration-management search toolbars include an Excel export action.
- The export includes all records from that club's registration table, including pending registrations, independent of the visible search filter.
- Columns are `학번`, `이름`. Rows sort by student ID, then name. Missing IDs sort last. Student IDs are text, preserving leading zeroes.
- Only the existing club administrator read scope may export. Both endpoints recheck current access. Read-only managers retain their existing read permissions.
- No payment, approval, deletion, role, schema, or RLS changes. Queries retrieve only ID (for pagination), student ID, and name. Files do not include emails or internal notes.
- Files are generated on demand, not stored in Supabase, and responses are private/no-store.

## Verification (2026-10-12)

- `npm run test:member-roster`: XLSX round trips, sorting, empty data, leading zeroes, formula safety, club isolation, access denial, 1,201 rows with a reduced page cap, fail-closed storage errors, download errors and double-click guard.
- `npm run typecheck` and `npm run build`: passed.
- `npm test`: existing pretest suites and type checking passed; stopped at unrelated traditional-liquor collection browser tests because local Chromium/Chrome launch is blocked by the macOS sandbox. Full Browser Safety/CI remains required before merge.
- In-app browser: actual ECC and Hanhwal buttons downloaded valid XLSX files. A filtered Hanhwal list still exported both sample members. Desktop (1440px), mobile (390px) and narrow English UI (320px) had no horizontal overflow. Search/no-results and Korean/English labels checked.
- UI fixture is local-only, synthetic, GET-only and not imported by production pages. It never changes production records.
- Production data and deployment have not been changed.

## Local Preview

`node scripts/member-roster-preview.mjs` serves synthetic registration panels at `http://127.0.0.1:3356/` (ECC) or `/?club=hanhwal`.
