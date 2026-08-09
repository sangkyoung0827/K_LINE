import "server-only";

import { SupabaseConfigError, supabaseRequest } from "@/lib/supabaseServer";
import type { FinanceAnalysis } from "@/lib/finance-engine/types";

type StoredAnalysis = { created_at: string; id: string; normalized_result: FinanceAnalysis; summary: string; symbol: string };
type StoredAnalysisSummary = Pick<StoredAnalysis, "created_at" | "id" | "summary" | "symbol">;

export type FinanceAnalysisSummary = {
  createdAt: string;
  id: string;
  summary: string;
  symbol: string;
};

export async function saveFinanceAnalysis(analysis: FinanceAnalysis) {
  try {
    await supabaseRequest("finance_analysis_runs", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ id: analysis.id, symbol: analysis.symbol, strategy_version: analysis.strategyVersion, mode: analysis.mode, summary: analysis.summary, normalized_result: analysis, raw_result: analysis.rawOutputs })
    });
    return true;
  } catch (error) {
    if (error instanceof SupabaseConfigError) return false;
    console.error("Finance analysis persistence failed", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}

export async function listRecentFinanceAnalyses(limit = 8) {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  try {
    const rows = await supabaseRequest<StoredAnalysis[]>(`finance_analysis_runs?select=id,symbol,summary,normalized_result,created_at&order=created_at.desc&limit=${safeLimit}`);
    return rows.map((row) => ({ ...row.normalized_result, createdAt: row.created_at, id: row.id, summary: row.summary, symbol: row.symbol }));
  } catch (error) {
    if (!(error instanceof SupabaseConfigError)) console.error("Finance analysis history failed", error instanceof Error ? error.message : "unknown error");
    return [] as FinanceAnalysis[];
  }
}

export async function listRecentFinanceAnalysisSummaries(limit = 8): Promise<FinanceAnalysisSummary[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 12);
  try {
    const rows = await supabaseRequest<StoredAnalysisSummary[]>(`finance_analysis_runs?select=id,symbol,summary,created_at&order=created_at.desc&limit=${safeLimit}`);
    return rows.map((row) => ({ createdAt: row.created_at, id: row.id, summary: row.summary, symbol: row.symbol }));
  } catch (error) {
    if (!(error instanceof SupabaseConfigError)) console.error("Finance analysis summary history failed", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

export async function getFinanceAnalysisById(id: string): Promise<FinanceAnalysis | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const rows = await supabaseRequest<StoredAnalysis[]>(`finance_analysis_runs?select=id,symbol,summary,normalized_result,created_at&id=eq.${encodeURIComponent(id)}&limit=1`);
    const row = rows[0];
    return row ? { ...row.normalized_result, createdAt: row.created_at, id: row.id, summary: row.summary, symbol: row.symbol } : null;
  } catch (error) {
    if (!(error instanceof SupabaseConfigError)) console.error("Finance analysis detail failed", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function listFinanceAnalysisMemory(symbol: string, limit = 3) {
  const safeLimit = Math.min(Math.max(limit, 1), 5);
  try {
    const rows = await supabaseRequest<StoredAnalysis[]>(`finance_analysis_runs?select=id,symbol,summary,normalized_result,created_at&symbol=eq.${encodeURIComponent(symbol)}&order=created_at.desc&limit=${safeLimit}`);
    return rows.map((row) => {
      const result = row.normalized_result;
      const action = result.decision?.action ?? "—";
      const confidence = result.decision?.confidence ?? "—";
      return `${row.created_at.slice(0, 16)} · ${action} (${confidence}%) · ${row.summary}`;
    });
  } catch (error) {
    if (!(error instanceof SupabaseConfigError)) console.error("Finance analysis memory failed", error instanceof Error ? error.message : "unknown error");
    return [] as string[];
  }
}
