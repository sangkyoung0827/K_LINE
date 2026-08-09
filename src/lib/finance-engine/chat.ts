import "server-only";

import { financeEngine } from "@/lib/finance-engine/service";

export type FinanceChatIntent =
  | { kind: "overview" }
  | { kind: "analyze"; symbol: string }
  | { kind: "paperTradeProposal"; symbol: string };

// This intentionally stops at the Finance Engine. It has no broker capability.
export function handleFinanceChatIntent(intent: FinanceChatIntent) {
  if (intent.kind === "overview") return financeEngine.getOverview();
  if (intent.kind === "analyze") return financeEngine.analyze(intent.symbol);
  return financeEngine.createPaperTradeProposal(intent.symbol);
}
