export function isConversationAdvice(message: string) {
  return /뭐라고\s*(?:답|말)|어떻게\s*(?:답|말|대응)|(?:답변|답장|대응|문구|문장).*(?:작성|만들|써|추천|다듬|수정|좋을)|(?:물어봤|물어보았|물어왔|물었|질문했|고민|상담)|what\s+should\s+I\s+(?:say|reply|tell)|how\s+(?:should|can|do)\s+I\s+(?:respond|reply)|(?:someone|a member).*(?:asked|told)\s+me|(?:draft|write|rewrite).*(?:reply|response|message)/i.test(message);
}

export function isMemberSummaryRequest(message: string) {
  if (isConversationAdvice(message)) return false;
  // Keep the count noun next to the entity: "만날 수" is not "회원 수".
  return /(?:정식\s*회원|정회원|회원|가입자)\s*(?:수(?:가|는|를|도|만)?(?=\s|[?？.!]|$)|현황|통계)|(?:회원|가입자)[^.!?\n]{0,16}몇\s*명|몇\s*명[^.!?\n]{0,16}(?:회원|가입)|\bmember(?:s)?\s+(?:count|summary|statistics)\b|\bhow many\s+(?:ecc\s+)?members\b/i.test(message);
}

export function explicitlyRequestsExternalResearch(message: string) {
  return /(?:외부|인터넷|웹|구글|네이버)\s*(?:에서\s*)?(?:검색|조사)|추가\s*(?:검색|조사)|search\s+(?:the\s+)?web|external\s+(?:search|research)|latest\s+(?:news|web)/i.test(message);
}

export function shouldSearchExternal(message: string, options: {
  businessCollection?: boolean;
  traditionalLiquorNeedsResearch?: boolean;
  journeyNeedsPlaces?: boolean;
  hasInternalAnswer?: boolean;
} = {}) {
  if (options.businessCollection || explicitlyRequestsExternalResearch(message)) return true;
  if (isConversationAdvice(message)) return false;
  if (options.hasInternalAnswer) return false;
  if (options.traditionalLiquorNeedsResearch) return true;
  if (options.journeyNeedsPlaces && /장소|관광|식당|음식점|맛집|카페|추천|여행|place|visit|restaurant|cafe|recommend|trip/i.test(message)) return true;
  // Search only when fresh/verifiable facts are requested, not for every chat turn.
  return /최신|뉴스|날씨|환율|주가|영업\s*시간|운영\s*시간|공식\s*(?:발표|자료)|출처|근거\s*자료|\b(?:latest|news|weather|exchange rate|stock price|opening hours|sources|citations)\b/i.test(message);
}

export function retrievalQuery(message: string, history: Array<{ role: string; content: string }>) {
  if (!/^(?:뭐라고|어떻게|그럼|그러면|이것|그것|그거|아까|위\s|답변|답장|더\s|짧게|길게|what should|how should|then|that|it\b)/i.test(message.trim())) return message;
  const topic = [...history].reverse().find((entry) => entry.role === "user"
    && entry.content !== message && !/^(?:뭐라고|어떻게|그럼|그러면|더\s|짧게|길게|what should|how should|then)/i.test(entry.content.trim()));
  return topic ? `${topic.content.slice(0, 1200)}\n${message}` : message;
}

export const conversationAnswerRules = `
Answer the actual conversational intent:
- A story about a member is not a request for member records or statistics.
- When asked how to respond to someone, write a usable reply to that person. Preserve who said what; do not attribute a quoted person's identity or orientation to the user.
- Do not add registration steps, links, or a general club introduction to interpersonal advice unless requested.
- Do not treat sexual orientation as misconduct or an inappropriate question. Be respectful, avoid assumptions about other members, and emphasize mutual consent and privacy when relevant.
- Do not invent club rules, inclusion policies, or promises about meeting a partner. Separate suggested wording from verified organizational facts.
- If external search was not performed, do not say search failed. Never claim unrelated retrieved material supports an answer.
- ECC here is Jeonbuk National University's English Conversation Club on K_LINE, not an unrelated language academy or another ECC organization.
- The verified ECC registration path is /ecc-join; official member page is /ecc-official; public club page is /our-activities/ecc. Use these relative links only when navigation is requested. Never invent an ECC domain or /new-member URL.
`;
