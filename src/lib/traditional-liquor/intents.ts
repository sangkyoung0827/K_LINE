import type { TraditionalLiquorQueryIntent } from "@/lib/traditional-liquor/types";

const openDatabasePatterns = [
  /전통주\s*(?:db|database|데이터베이스)\s*(?:열어|보여\s*줘|보여줘|open)/i,
  /(?:open|show)\s+(?:the\s+)?traditional\s+(?:liquor|alcohol)\s+(?:db|database)/i
];

export function detectTraditionalLiquorIntent(message: string): TraditionalLiquorQueryIntent | null {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (openDatabasePatterns.some((pattern) => pattern.test(normalized))) {
    return "OPEN_TRADITIONAL_LIQUOR_DATABASE";
  }
  return null;
}

