# Personal Conversation Memory

WooHyukmon reuses private conversation records; this is retrieval and personalization, not model fine-tuning or shared training. No conversation is added to the shared Knowledge DB.

- Existing `woohyukmon_projects`, `woohyukmon_chats` and `woohyukmon_messages` tables retain conversations. No database migration is required.
- The main chat already persists turns; the global operations chat and the journey chat now save turns through the same authenticated APIs. Their saved conversations can be opened in the main chat history. Automatic Memory Book recommendations are not fabricated user conversations and are not logged.
- Personal retrieval is server-only. The signed-in email scopes messages, chats and projects. Archived chats/projects are excluded. Guests have no personal memory. The existing history RLS configuration remains unchanged.
- For each reply, up to 200 recent user messages and 50 explicit preference statements are considered; up to five relevant excerpts (600 characters each) enter the context. Preference statements are queried separately so they do not vanish merely because 200 ordinary messages were sent afterwards. Assistant answers are not treated as remembered facts. Stored logs are not trimmed by these retrieval limits.
- Only explicit persistent style requests (for example, "from now on" or "I prefer") update presentation preferences. Newer instructions win; a current one-off instruction overrides the default for that reply. No sensitive user characteristics or permissions are inferred.
- The "Use my saved conversations" checkbox disables cross-conversation retrieval, not saving or the current conversation. The choice is per account in this browser. Archived conversations stop contributing to memory. No derived profile or vector store needs separate deletion.
- History retrieval has a four-second deadline and fails open to an ordinary answer. Save failures are shown in the chat. Keys/password-like content is excluded from reuse. Retrieved user statements are untrusted context, not system instructions or verified live club facts.
- Client requests include the expected signed-in owner; a changed account receives HTTP 409 before saving or generating with stale history. Authentication remains the source of ownership.

Validation covers owner isolation, archived filters, assistant/secret exclusion, explicit corrections, one-off tone requests, bounded relevance and account changes. Live verification must use consenting test accounts, not edit real members or manufacture production conversations under other users.
