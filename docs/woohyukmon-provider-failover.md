# WooHyukmon response failover

The `/api/gemini`, `/api/woohyukmon`, and `/api/jeju/assistant` endpoints share the server-side answer generator. The normal order is Gemini, NVIDIA, OpenAI, then an optional OpenAI-compatible provider. Missing credentials are skipped. Upstream failures, timeouts, invalid/empty output and truncated output advance to the next configured provider. Content-policy refusals do not trigger a bypass.

The same system instructions, authorized retrieval context, uploaded-training excerpts and conversation history are sent to each attempted model. Stored files, chunks, embeddings, database permissions, and operations are not rewritten or replayed. The legacy answer cache was removed because a cache based on only the last two messages could return an answer from the wrong conversation context.

## Configuration

Set secrets in the **K_LINE** Vercel project. Do not use `NEXT_PUBLIC_` names for API keys. Existing Gemini and OpenAI variables continue to work.

| Variable | Purpose |
| --- | --- |
| `WOOHYUKMON_PROVIDER_ORDER` | Default `gemini,nvidia,openai,compatible` |
| `WOOHYUKMON_PROVIDER_TIMEOUT_MS` | Per-provider whole-response timeout; default 25000, maximum 30000 |
| `WOOHYUKMON_NVIDIA_API_KEY` | Chat-specific NVIDIA credential; falls back to `NVIDIA_API_KEY` |
| `WOOHYUKMON_NVIDIA_MODEL` | NVIDIA model; default `nvidia/nemotron-3.5-lightning-30b-a3b` |
| `WOOHYUKMON_OPENAI_API_KEY` | Optional chat credential; falls back to existing `OPENAI_API_KEY` without changing the embedding credential |
| `WOOHYUKMON_OPENAI_MODEL` | Default existing `OPENAI_MODEL`, otherwise `gpt-4o-mini` |
| `WOOHYUKMON_COMPATIBLE_API_KEY` | Optional additional provider credential |
| `WOOHYUKMON_COMPATIBLE_BASE_URL` | Its HTTPS OpenAI-compatible API base URL, including `/v1` where required |
| `WOOHYUKMON_COMPATIBLE_MODEL` | Its exact model ID |

Heather's NVIDIA integration uses the same OpenAI-compatible protocol. Its UI, private memory and credentials are not imported into K_LINE. Vercel sensitive values may be returned as `[REDACTED]` by `env pull`; that is not a usable key and must never replace a production secret. Add the original key in the dashboard if a different project's secret cannot be copied.

## Behavior and limits

- Each request attempts each configured provider at most once. Errors trigger an instance-local cooldown (15 seconds normally, 75 seconds for quota errors, 5 minutes for configuration/auth errors), respecting a longer `Retry-After` up to one hour. Gemini's local RPM check defaults to 12. These are per-instance protections, not a distributed quota ledger; upstream quotas remain authoritative.
- A provider's answer is buffered until complete, so a failed partial answer is never mixed with the next provider's answer. NDJSON status/heartbeat events keep the waiting UI connected. Text appears after successful generation. This intentionally trades token-by-token display for consistent failover.
- Recent context grows from 8 short messages to at most 48 messages / 60,000 characters. Full saved conversations stay in existing history storage, but unlimited historical recall is not promised.
- Chat request duration is 180 seconds. Each provider has a bounded timeout and client cancellation stops further attempts. All-provider failure is still possible; it returns an explicit error without deleting the conversation.
- Search-query embedding requests have an 8-second deadline; existing keyword retrieval remains available on embedding failure. Upload processing and stored vectors are unchanged.

## Verification

`npm run test:woohyukmon` exercises quota/auth/network/timeouts, missing keys, safety refusals, cancellation, cooldown recovery, context preservation and bounded history. It is included in `npm test` / `npm run check`. Validate actual credentials using a deployed environment, since redacted local values cannot demonstrate provider health.
