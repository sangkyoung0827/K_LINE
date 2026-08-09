import "server-only";

import { computeFinanceIndicators } from "@/lib/finance-engine/indicators";
import type { FinanceCandle, FinanceMarketSnapshot } from "@/lib/finance-engine/types";

const cryptoNames: Record<string, string> = { BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP", DOGE: "Dogecoin" };
export class FinanceMarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceMarketDataError";
  }
}
const aliases: Record<string, { display: string; kind: "krstock" | "stock"; symbol: string; yahoo: string }> = {
  "삼성전자": { display: "SAMSUNG", kind: "krstock", symbol: "SAMSUNG", yahoo: "005930.KS" },
  SAMSUNG: { display: "SAMSUNG", kind: "krstock", symbol: "SAMSUNG", yahoo: "005930.KS" },
  "005930": { display: "SAMSUNG", kind: "krstock", symbol: "SAMSUNG", yahoo: "005930.KS" },
  "SK하이닉스": { display: "SKHYNIX", kind: "krstock", symbol: "SKHYNIX", yahoo: "000660.KS" },
  SKHYNIX: { display: "SKHYNIX", kind: "krstock", symbol: "SKHYNIX", yahoo: "000660.KS" }
};

export function resolveFinanceSymbol(input: string) {
  const value = input.trim().toUpperCase();
  const alias = aliases[input.trim()] ?? aliases[value];
  if (alias) return alias;
  const crypto = value.replace(/-?USDT$/, "");
  if (cryptoNames[crypto]) return { display: crypto, kind: "crypto" as const, symbol: crypto, yahoo: "" };
  return { display: value, kind: "stock" as const, symbol: value, yahoo: value };
}

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new FinanceMarketDataError(`Market data request failed with ${response.status}.`);
  return response.json() as Promise<unknown>;
}

async function fetchCandles(resolved: ReturnType<typeof resolveFinanceSymbol>, signal: AbortSignal): Promise<FinanceCandle[]> {
  if (resolved.kind === "crypto") {
    const raw = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(resolved.symbol)}USDT&interval=1d&limit=120`, signal) as unknown[];
    if (!Array.isArray(raw) || !raw.length) throw new FinanceMarketDataError("Market candle data is unavailable.");
    return raw.map((row) => {
      const item = row as unknown[];
      return { t: Number(item[0]), o: Number(item[1]), h: Number(item[2]), l: Number(item[3]), c: Number(item[4]), v: Number(item[5]) };
    });
  }
  const raw = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(resolved.yahoo)}?range=6mo&interval=1d`, signal) as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }> } };
  const result = raw.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote?.close) throw new FinanceMarketDataError("Market candle data is unavailable.");
  return result.timestamp.flatMap((timestamp, index) => {
    const values = [quote.open?.[index], quote.high?.[index], quote.low?.[index], quote.close?.[index], quote.volume?.[index]];
    if (values.some((value) => value == null || !Number.isFinite(value))) return [];
    return [{ t: timestamp * 1000, o: Number(values[0]), h: Number(values[1]), l: Number(values[2]), c: Number(values[3]), v: Number(values[4]) }];
  });
}

async function fetchHeadlines(query: string, signal: AbortSignal) {
  try {
    const response = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`, { signal });
    if (!response.ok) return [];
    const xml = await response.text();
    return Array.from(xml.matchAll(/<title>([\s\S]*?)<\/title>/g)).slice(1, 7).map((match) => match[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim()).filter(Boolean);
  } catch { return []; }
}

export async function collectMarketSnapshot(input: string, signal: AbortSignal): Promise<FinanceMarketSnapshot> {
  const resolved = resolveFinanceSymbol(input);
  const candles = await fetchCandles(resolved, signal);
  const indicators = computeFinanceIndicators(candles);
  const headlines = await fetchHeadlines(`${resolved.kind === "crypto" ? cryptoNames[resolved.symbol] ?? resolved.symbol : resolved.display} stock`, signal);
  const fundamentals = resolved.kind === "crypto" ? ["Crypto fundamentals require an approved market source."] : ["Fundamental source is not connected in this portable engine run."];
  const sentiment = resolved.kind === "crypto" ? ["Market sentiment source is not connected in this portable engine run."] : ["Sentiment is evaluated from supplied headlines only."];
  return {
    candles, display: resolved.display, fundamentals, headlines, indicators,
    kind: resolved.kind, priceLine: `${resolved.display} ${indicators.price.toFixed(2)} (${indicators.changePct24h >= 0 ? "+" : ""}${indicators.changePct24h.toFixed(2)}%)`, sentiment, symbol: resolved.symbol
  };
}
