import type { TraditionalLiquorQueryIntent } from "@/lib/traditional-liquor/types";

const exactOpenDatabaseCommands = new Set([
  "전통주 DB열어",
  "전통주 데이터베이스 열어"
]);

export function detectTraditionalLiquorIntent(message: string): TraditionalLiquorQueryIntent | null {
  const normalized = message.trim();
  if (!normalized) return null;
  if (exactOpenDatabaseCommands.has(normalized)) {
    return "OPEN_TRADITIONAL_LIQUOR_DATABASE";
  }
  return null;
}
