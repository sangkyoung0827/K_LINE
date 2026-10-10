# Event Studio Production

The ECC administrator page at /admin/google-forms reuses the existing three-tab
manager. Native applications, member approvals, fees and records remain unchanged.

## Server Configuration

- EVENT_AI_OPENAI_API_KEY: secret, production only; never expose to clients.
- EVENT_AI_ENABLED=true
- EVENT_AI_PROVIDER=openai
- EVENT_AI_PRIMARY_MODEL=gpt-6-luna
- EVENT_AI_COMPLEX_MODEL=gpt-6.1-sol

The event-specific key takes priority over OPENAI_API_KEY. Existing general AI
provider settings are not changed. Calls use the Responses API and store=false.

Apply 20261010172743_event_studio.sql before enabling the new configuration.
Its tables and quota RPC are additive, RLS-enabled and service-role-only.
The production store permits only the new event_ai_reserve RPC; ECC permission
and legacy membership writes remain blocked.

## Release Scope

Production access remains ECC administrator-or-higher, with read-only access
preserved. Other-club adapters and native mobile application code are not part
of this release. Missing dates, venue or capacity require administrator review.

Approval creates an unpublished Google Form and a private notice draft.
Announcements and application links can be copied separately.
This release does not open recruitment, grant respondent permissions or publish
notices automatically. Those existing production safeguards remain in effect.

Each call consumes a persisted daily quota reservation and records model,
tokens, duration, error code and estimated cost without logging prompts or keys.
Default limits are 10 calls per user and 50 per club per UTC day.

## Validation

- Event Studio tests: schema, grounding, permissions, quotas, signed approval,
  concurrent approval, remote question verification and failure recovery.
- Existing Google Forms and all repository regression checks.
- Browser Safety CI must pass before merge.
- Production: anonymous and cross-origin requests denied; authenticated admin
  generation tested without opening recruitment or changing member data.

Rollback: promote the previous production deployment. Disable EVENT_AI_ENABLED
for future builds if needed. Keep additive tables to preserve saved drafts.
