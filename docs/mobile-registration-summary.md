# Mobile ECC Registration Summary

Checkpoint: 2026-10-07. Local implementation only; not deployed.

Below the existing `md` breakpoint, submitted ECC registrations appear in one
compact disclosure showing submission and approval/payment status. Details open
on tap, with a single unframed vertical list instead of ten separate boxes.
Long names and emails wrap without horizontal overflow. The original edit or
ECC OFFICIAL action remains inside the expanded area.

Desktop retains the existing heading, status badge, description, avatar,
two-column details and actions. New applicants' input forms are unchanged.
All original status calculations, permissions, fetch/submit handlers, fields,
payment and approval values are unchanged. No database or API files were edited.

The UI-only `EccRegistrationSummary` holds only an expansion boolean. It performs
no requests or persistent writes. Fields/actions remain mounted, with responsive
visibility and accessible `aria-expanded`/`aria-controls` bindings.

## Verification

- ECC mobile, approval retry, outage entry and read-only developer tests: 23 passed.
- TypeScript, production Next build and browser metadata validation passed.
- Browser QA: 390px Korean approved, 320px English payment pending, expand/collapse,
  long email wrapping, original edit/official controls, and 1280px two-column
  desktop details. Both mobile views had scrollWidth equal to viewport width.
- Full repository `npm run check` is not claimed: the previous full run was blocked
  by an unrelated Chromium collector launch under the sandbox. No merge or
  production deployment was attempted.

Run the isolated real-component preview:

```sh
node scripts/ecc-registration-summary-preview.mjs
```

Open `http://127.0.0.1:3340/`. Query `state=pending&language=en` shows the pending
English state. All preview fetches are mocked with clearly marked sample data;
mutations return 403. This preview does not access real member records. It is not
a functional ECC OFFICIAL navigation or submission endpoint.
