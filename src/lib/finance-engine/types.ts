export type FinanceMode = "PAPER" | "LIVE";
export type FinanceMetricKey =
  | "totalAssets"
  | "cash"
  | "stocks"
  | "etf"
  | "crypto"
  | "portfolioValue"
  | "totalReturn"
  | "todayPnl"
  | "activePositions"
  | "totalTrades"
  | "winRate"
  | "profitFactor"
  | "maxDrawdown";

export type FinanceMetric = {
  key: FinanceMetricKey;
  label: string;
  value: number | null;
  format: "currency" | "number" | "percent" | "ratio";
};

export type FinanceOverview = {
  experimentalCapitalKrw: number;
  metrics: FinanceMetric[];
  mode: FinanceMode;
  state: "empty";
};

export type FinanceAgentId = "taro" | "diana" | "nova" | "vibe" | "bull" | "bear" | "ace" | "risky" | "safe" | "neutral" | "pm";

export type FinanceCandle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type FinanceIndicators = {
  changePct24h: number;
  high20: number;
  low20: number;
  macd: number;
  macdSignal: number;
  price: number;
  rsi14: number | null;
  sma20: number | null;
  sma50: number | null;
  summaryLines: string[];
  volatilityPct: number;
};

export type FinanceMarketSnapshot = {
  candles: FinanceCandle[];
  display: string;
  fundamentals: string[];
  headlines: string[];
  indicators: FinanceIndicators;
  kind: "crypto" | "stock" | "krstock";
  priceLine: string;
  sentiment: string[];
  symbol: string;
};

export type FinanceAgentResult = {
  bubble: string;
  id: FinanceAgentId;
  name: string;
  report: string;
  turn?: number;
};

export type FinanceDecision = {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number | null;
  entry: string;
  rationale: string;
  sizing: string;
  stop: string;
  target: string;
  verdict: "APPROVE" | "AMEND" | "REJECT" | "UNAVAILABLE";
};

export type FinanceAnalysis = {
  agentResults: FinanceAgentResult[];
  createdAt: string;
  decision: FinanceDecision;
  id: string;
  marketSnapshot: FinanceMarketSnapshot;
  mode: "PAPER";
  persistence: "saved" | "unavailable";
  rawOutputs: Record<string, unknown>;
  riskReview: FinanceAgentResult[];
  state: "complete";
  strategyVersion: string;
  summary: string;
  symbol: string;
};

export type PaperTradeProposal = {
  message: string;
  mode: "PAPER";
  state: "proposal_only";
  symbol: string;
};

export type BrokerOrder = {
  mode: FinanceMode;
  quantity: number;
  side: "BUY" | "SELL";
  symbol: string;
};

export type BrokerAdapter = {
  cancelOrder(orderId: string): Promise<void>;
  getAccount(): Promise<null>;
  getBalance(): Promise<null>;
  getOrders(): Promise<never[]>;
  getPositions(): Promise<never[]>;
  getQuote(symbol: string): Promise<null>;
  placeOrder(order: BrokerOrder): Promise<never>;
};
