import "server-only";

import { analystIds, debateIds, riskIds, runFinanceAgent } from "@/lib/finance-engine/agents";
import { collectMarketSnapshot } from "@/lib/finance-engine/market";
import { getFinanceLlmProvider } from "@/lib/finance-engine/provider";
import { listFinanceAnalysisMemory, saveFinanceAnalysis } from "@/lib/finance-engine/repository";
import { defaultStrategyVersion } from "@/lib/finance-engine/strategy";
import type { FinanceAgentResult, FinanceAnalysis, FinanceDecision } from "@/lib/finance-engine/types";

function safeAction(value: unknown): FinanceDecision["action"] { const action = String(value ?? "HOLD").toUpperCase(); return action === "BUY" || action === "SELL" ? action : "HOLD"; }
function safeVerdict(value: unknown): FinanceDecision["verdict"] { const verdict = String(value ?? "UNAVAILABLE").toUpperCase(); return verdict === "APPROVE" || verdict === "AMEND" || verdict === "REJECT" ? verdict : "UNAVAILABLE"; }
function pick(value: unknown) { return typeof value === "string" && value.trim() ? value.trim().slice(0, 1200) : "Not provided"; }
function failedAgent(id: FinanceAgentResult["id"], name: string, error: unknown): FinanceAgentResult {
  const detail = error instanceof Error ? error.message : "The agent did not return a result.";
  return { id, name, bubble: "Unavailable for this run.", report: `Unavailable: ${detail}` };
}

export async function runOriginalAlgorithmPort(input: string, signal: AbortSignal): Promise<FinanceAnalysis> {
  const marketSnapshot = await collectMarketSnapshot(input, signal);
  const memory = await listFinanceAnalysisMemory(marketSnapshot.symbol);
  const provider = getFinanceLlmProvider();
  const analystRaw = await Promise.allSettled(analystIds.map((id) => runFinanceAgent(id, { market: marketSnapshot }, provider, signal)));
  const analystResults = analystRaw.map((result, index) => {
    if (result.status === "fulfilled") {
      const { id, name, bubble, report } = result.value;
      return { id, name, bubble, report };
    }
    const id = analystIds[index];
    return failedAgent(id, id.toUpperCase(), result.reason);
  });
  const rawOutputs: Record<string, unknown> = { analysts: analystRaw };
  const debateResults: FinanceAgentResult[] = [];
  for (const [index, id] of debateIds.entries()) {
    try {
      const result = await runFinanceAgent(id, { market: marketSnapshot, analystResults, debateResults }, provider, signal);
      rawOutputs[`debate-${index + 1}-${id}`] = result;
      debateResults.push({ id: result.id, name: result.name, bubble: result.bubble, report: result.report, turn: index + 1 });
    } catch (error) {
      debateResults.push({ ...failedAgent(id, id.toUpperCase(), error), turn: index + 1 });
    }
  }
  const ace = await runFinanceAgent("ace", { market: marketSnapshot, analystResults, debateResults, memory }, provider, signal);
  rawOutputs.ace = ace;
  const proposedDecision = { action: safeAction(ace.action), confidence: typeof ace.confidence === "number" ? ace.confidence : null, entry: pick(ace.entry), stop: pick(ace.stop), target: pick(ace.target), rationale: pick(ace.rationale) };
  const riskReview: FinanceAgentResult[] = [];
  for (const id of riskIds) {
    try {
      const result = await runFinanceAgent(id, { market: marketSnapshot, analystResults, debateResults, proposedDecision, riskResults: riskReview }, provider, signal);
      rawOutputs[`risk-${id}`] = result;
      riskReview.push({ id: result.id, name: result.name, bubble: result.bubble, report: result.report });
    } catch (error) {
      riskReview.push(failedAgent(id, id.toUpperCase(), error));
    }
  }
  const pm = await runFinanceAgent("pm", { market: marketSnapshot, analystResults, debateResults, memory, proposedDecision, riskResults: riskReview }, provider, signal);
  rawOutputs.pm = pm;
  const verdict = safeVerdict(pm.verdict);
  const decision: FinanceDecision = {
    action: verdict === "REJECT" ? "HOLD" : safeAction(pm.action ?? ace.action), confidence: typeof pm.confidence === "number" ? pm.confidence : typeof ace.confidence === "number" ? ace.confidence : null,
    entry: pick(pm.entry ?? ace.entry), stop: pick(pm.stop ?? ace.stop), target: pick(pm.target ?? ace.target), rationale: pick(pm.rationale ?? ace.rationale), sizing: pick(pm.sizing), verdict
  };
  const analysis: FinanceAnalysis = {
    id: crypto.randomUUID(), symbol: marketSnapshot.symbol, createdAt: new Date().toISOString(), strategyVersion: "ORIGINAL_PORT_V1", mode: "PAPER", state: "complete", persistence: "unavailable", marketSnapshot,
    agentResults: [...analystResults, ...debateResults, { id: "ace", name: ace.name, bubble: ace.bubble, report: ace.report }], rawOutputs, riskReview, decision,
    summary: `${marketSnapshot.display}: ${decision.action} research outcome (${decision.confidence ?? "-"}% confidence). PM: ${decision.verdict}.`
  };
  const persisted = await saveFinanceAnalysis(analysis);
  return { ...analysis, persistence: persisted ? "saved" : "unavailable", strategyVersion: defaultStrategyVersion.version === "0.1.0" ? "ORIGINAL_PORT_V1" : defaultStrategyVersion.version };
}
