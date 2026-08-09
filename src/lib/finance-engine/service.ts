import "server-only";

import { PaperBroker, RealBroker } from "@/lib/finance-engine/broker";
import { defaultRiskPolicy } from "@/lib/finance-engine/risk";
import { runOriginalAlgorithmPort } from "@/lib/finance-engine/analysis";
import type { FinanceAnalysis, FinanceOverview, PaperTradeProposal } from "@/lib/finance-engine/types";

export const financeEngine = {
  brokers: {
    paper: new PaperBroker(),
    real: new RealBroker()
  },
  riskPolicy: defaultRiskPolicy,

  getOverview(): FinanceOverview {
    return {
      experimentalCapitalKrw: 100000,
      mode: "PAPER",
      state: "empty",
      metrics: [
        { key: "totalAssets", label: "Total Assets", value: null, format: "currency" },
        { key: "cash", label: "Cash", value: null, format: "currency" },
        { key: "stocks", label: "Stocks", value: null, format: "currency" },
        { key: "etf", label: "ETF", value: null, format: "currency" },
        { key: "crypto", label: "Crypto", value: null, format: "currency" },
        { key: "portfolioValue", label: "Portfolio Value", value: null, format: "currency" },
        { key: "totalReturn", label: "Total Return", value: null, format: "percent" },
        { key: "todayPnl", label: "Today P&L", value: null, format: "currency" },
        { key: "activePositions", label: "Active Positions", value: null, format: "number" },
        { key: "totalTrades", label: "Total Trades", value: null, format: "number" },
        { key: "winRate", label: "Win Rate", value: null, format: "percent" },
        { key: "profitFactor", label: "Profit Factor", value: null, format: "ratio" },
        { key: "maxDrawdown", label: "Max Drawdown", value: null, format: "percent" }
      ]
    };
  },

  analyze(symbol: string, signal: AbortSignal): Promise<FinanceAnalysis> {
    return runOriginalAlgorithmPort(symbol, signal);
  },

  createPaperTradeProposal(symbol: string): PaperTradeProposal {
    return {
      symbol,
      mode: "PAPER",
      state: "proposal_only",
      message: "Paper trade execution is intentionally disabled in Phase 1. This endpoint only reserves the approval boundary."
    };
  }
};
