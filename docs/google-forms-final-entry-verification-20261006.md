# ECC Google Forms Final Entry Verification

## Verified

- Google Forms automated tests: 47 passed.
- Existing ECC approval, outage and read-only developer regressions: 16 passed.
- `npm run typecheck`, `npm run build`, and `git diff --check`: passed.
- Real Supabase test-table lease persistence and Google permission revocation: passed in the separate 30-second accelerated integration test. See `google-forms-server-revocation-integrated-20261006.json`.
- Local participant preview loads the actual entry component and real entry API. Anonymous users receive the login link rather than respondent access.
- Mobile preview at 390 x 844: document width equals viewport width, without horizontal overflow.
- User completed real Google sign-in as `samgkyoung1004@gmail.com`; server verified the Google profile email and verified-email flag.
- Actual native ECC read returned eligible, showing the Open form button.
- Controlled lookup outage showed Woohyukmon's payment question. Not yet displayed payment instructions without entering the form.
- Yes issued an actual respondent-only permission and an active test-table lease with a recorded permission ID and 15-minute expiry.
- Google account selection was explicitly switched to `samgkyoung1004@gmail.com`. The real Google respondent page displayed that account and the application questions.
- The Google respondent page at 390 x 844 had no horizontal overflow.
- Returning to normal membership lookup and opening the form succeeded; the test lease became `promoted`, preserving confirmed-member access.
- No application response was submitted.

## Pending

- This isolated preview uses verified Google OIDC identity, not the production NextAuth session. Production authentication remains unverified here.
- No production deployment, production feature activation, or permanent production revocation scheduler has been performed.
- In multi-account Google browsers, a bare respondent URL can select the default Google account rather than the locally authenticated account. The account-switch control was needed in this test; the verified responder screenshot is the test account, not the form owner.
- The full real-time 15-minute revocation wait was not repeated here; the separate controlled 30-second test verified deletion. This confirmed member's lease was deliberately promoted instead.

## Test Boundaries

- Preview URL: `http://localhost:3300/`.
- Existing native ECC roles are read only. No payment or member-role writes are performed.
- The outage scenario is deliberately injected only for the authorized participant; it is not evidence of a real current membership outage.
- A newly created, restricted, clearly labeled private test form is used. Existing activity forms are unchanged.
- Google operations credentials remain in the approved private test configuration. Participant OAuth access tokens are not stored.
- The local preview revoker runs every 30 seconds while the preview process remains running. This does not install a production scheduler.
- Stopping the preview with SIGINT or SIGTERM unpublishes its test form.
