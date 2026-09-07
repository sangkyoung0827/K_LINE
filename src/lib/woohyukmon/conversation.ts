export type ConversationMessage = { role: "user" | "assistant"; content: string };

// Bound the request size without dropping context after just four exchanges.
export function conversationHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: ConversationMessage[] = [];
  let remaining = 60_000;
  for (let index = value.length - 1; index >= 0 && messages.length < 48 && remaining > 0; index--) {
    const item = value[index];
    if (!item || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") continue;
    const content = item.content.trim().slice(0, Math.min(12_000, remaining));
    if (!content) continue;
    messages.unshift({ role: item.role, content });
    remaining -= content.length;
  }
  return messages;
}
