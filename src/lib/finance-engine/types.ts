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

export type FinanceAnalysis = {
  message: string;
  mode: FinanceMode;
  state: "not_configured";
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
