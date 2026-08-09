import "server-only";

export type StrategyVersion = {
  id: string;
  name: string;
  version: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

// Every future signal, proposal, and trade must retain this version reference.
export const defaultStrategyVersion: StrategyVersion = {
  id: "woohyukmon-finance-foundation",
  name: "WooHyukmon Finance Foundation",
  version: "0.1.0",
  status: "DRAFT"
};
