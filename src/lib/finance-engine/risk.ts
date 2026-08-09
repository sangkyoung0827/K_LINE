import "server-only";

export type RiskPolicy = {
  dailyLossLimitPercent: number;
  maxConcurrentPositions: number;
  maxDrawdownPercent: number;
  maxPositionPercent: number;
  riskPerTradePercent: number;
};

export const defaultRiskPolicy: RiskPolicy = {
  dailyLossLimitPercent: 2,
  maxConcurrentPositions: 3,
  maxDrawdownPercent: 8,
  maxPositionPercent: 20,
  riskPerTradePercent: 0.5
};

export function calculatePositionSize(input: {
  accountEquity: number;
  entryPrice: number;
  riskPerTradePercent?: number;
  stopLossPrice: number;
}) {
  const riskPerShare = Math.abs(input.entryPrice - input.stopLossPrice);
  const riskBudget = input.accountEquity * ((input.riskPerTradePercent ?? defaultRiskPolicy.riskPerTradePercent) / 100);

  if (riskPerShare <= 0 || input.accountEquity <= 0) {
    return { quantity: 0, riskBudget };
  }

  return {
    quantity: Math.floor(riskBudget / riskPerShare),
    riskBudget
  };
}

