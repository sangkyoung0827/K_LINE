import "server-only";

import type { FinanceCandle } from "@/lib/finance-engine/types";

function average(values: number[], period: number) {
  if (values.length < period) return null;
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

function ema(values: number[], period: number) {
  if (!values.length) return [];
  const rate = 2 / (period + 1);
  return values.reduce<number[]>((series, value, index) => {
    series.push(index === 0 ? value : value * rate + series[index - 1] * (1 - rate));
    return series;
  }, []);
}

function rsi(values: number[], period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const difference = values[index] - values[index - 1];
    if (difference >= 0) gains += difference;
    else losses -= difference;
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const difference = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(difference, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-difference, 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function computeFinanceIndicators(candles: FinanceCandle[]) {
  if (!candles.length) throw new Error("No candle data is available.");
  const closes = candles.map(({ c }) => c);
  const price = closes.at(-1) ?? 0;
  const previous = closes.at(-2) ?? price;
  const sma20 = average(closes, 20);
  const sma50 = average(closes, 50);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = closes.map((_, index) => fast[index] - slow[index]);
  const signalLine = ema(macdLine, 9);
  const macd = macdLine.at(-1) ?? 0;
  const macdSignal = signalLine.at(-1) ?? 0;
  const rsi14 = rsi(closes);
  const recent = candles.slice(-20);
  const high20 = Math.max(...recent.map(({ h }) => h));
  const low20 = Math.min(...recent.map(({ l }) => l));
  const changePct24h = previous ? ((price - previous) / previous) * 100 : 0;
  const returns = closes.slice(1).map((close, index) => (closes[index] ? (close - closes[index]) / closes[index] : 0));
  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  const volatilityPct = Math.sqrt(variance) * Math.sqrt(365) * 100;
  const format = (value: number | null, digits = 2) => (value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits));
  return {
    changePct24h, high20, low20, macd, macdSignal, price, rsi14, sma20, sma50, volatilityPct,
    summaryLines: [
      `Current price ${format(price)} (${changePct24h >= 0 ? "+" : ""}${format(changePct24h)}%)`,
      `SMA20 ${format(sma20)} / SMA50 ${format(sma50)} - price is ${sma20 == null ? "unavailable" : price >= sma20 ? "above SMA20" : "below SMA20"}`,
      `RSI14 ${format(rsi14, 1)}`,
      `MACD ${format(macd, 4)} / signal ${format(macdSignal, 4)}`,
      `20-day high ${format(high20)} / low ${format(low20)} / annualized volatility ${format(volatilityPct, 1)}%`
    ]
  };
}
