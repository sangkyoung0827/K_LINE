import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.TOSS_LOCAL_BRIDGE_PORT || "45821", 10);
const TOSS_BASE_URL = "https://openapi.tossinvest.com";
const DEFAULT_ORIGINS = ["https://kline-nine-wheat.vercel.app", "http://localhost:3000"];

function loadLocalEnvironment() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".toss-local.env"), "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^("|')(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("Could not read .toss-local.env", error);
  }
}

loadLocalEnvironment();

const allowedOrigins = new Set((process.env.KLINE_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(",")).split(",").map((origin) => origin.trim()).filter(Boolean));
let tokenCache = null;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maskedAccountNumber(value) {
  return value && value.length >= 4 ? `••••${value.slice(-4)}` : null;
}

function bridgeHeaders(request) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    "Vary": "Origin, Access-Control-Request-Private-Network",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function localConfiguration() {
  const clientId = process.env.TOSSINVEST_CLIENT_ID?.trim() || process.env.TOSS_CLIENT_ID?.trim();
  const clientSecret = process.env.TOSSINVEST_CLIENT_SECRET?.trim() || process.env.TOSS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Local Toss credentials are not configured.");
  return { clientId, clientSecret };
}

async function errorText(response) {
  try {
    const body = await response.json();
    return body?.error_description || body?.error?.message || body?.error || `Toss returned HTTP ${response.status}.`;
  } catch {
    return `Toss returned HTTP ${response.status}.`;
  }
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const { clientId, clientSecret } = localConfiguration();
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  const response = await fetch(`${TOSS_BASE_URL}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!response.ok) throw new Error(await errorText(response));
  const token = await response.json();
  if (!token.access_token) throw new Error("Toss did not return an access token.");
  tokenCache = { value: token.access_token, expiresAt: Date.now() + Math.max(60, Number(token.expires_in) || 0) * 1000 };
  return tokenCache.value;
}

async function tossRequest(path, accountSequence) {
  const token = await accessToken();
  const headers = { Authorization: `Bearer ${token}` };
  if (accountSequence !== undefined) headers["X-Tossinvest-Account"] = String(accountSequence);
  let response = await fetch(`${TOSS_BASE_URL}${path}`, { headers, cache: "no-store" });
  if (response.status === 401) {
    tokenCache = null;
    headers.Authorization = `Bearer ${await accessToken()}`;
    response = await fetch(`${TOSS_BASE_URL}${path}`, { headers, cache: "no-store" });
  }
  if (!response.ok) throw new Error(await errorText(response));
  const body = await response.json();
  return body.result;
}

async function portfolio() {
  const accounts = await tossRequest("/api/v1/accounts");
  const configuredSequence = optionalNumber(process.env.TOSSINVEST_ACCOUNT_SEQ);
  const account = configuredSequence === null ? accounts[0] : accounts.find((item) => item.accountSeq === configuredSequence);
  if (!account) throw new Error("No eligible Toss brokerage account was found.");
  const overview = await tossRequest("/api/v1/holdings", account.accountSeq);
  const totalKrw = numberValue(overview.marketValue?.amount?.krw);
  const totalUsd = numberValue(overview.marketValue?.amount?.usd);
  const holdings = (overview.items || []).map((item) => {
    const marketValue = numberValue(item.marketValue?.amount);
    const currencyTotal = item.currency === "KRW" ? totalKrw : totalUsd;
    return {
      symbol: item.symbol,
      name: item.name,
      marketCountry: item.marketCountry,
      currency: item.currency,
      quantity: numberValue(item.quantity),
      lastPrice: numberValue(item.lastPrice),
      averagePurchasePrice: numberValue(item.averagePurchasePrice),
      marketValue,
      profitLoss: numberValue(item.profitLoss?.amount),
      profitLossRate: optionalNumber(item.profitLoss?.rate),
      dailyProfitLoss: optionalNumber(item.dailyProfitLoss?.amount),
      allocationPercent: currencyTotal > 0 ? (marketValue / currencyTotal) * 100 : null
    };
  });
  return {
    account: { sequence: account.accountSeq, type: account.accountType || "BROKERAGE", maskedNumber: maskedAccountNumber(account.accountNo) },
    asOf: new Date().toISOString(),
    totals: {
      marketValue: { krw: totalKrw, usd: totalUsd },
      purchaseAmount: { krw: numberValue(overview.totalPurchaseAmount?.krw), usd: numberValue(overview.totalPurchaseAmount?.usd) },
      profitLoss: { krw: numberValue(overview.profitLoss?.amount?.krw), usd: numberValue(overview.profitLoss?.amount?.usd), rate: optionalNumber(overview.profitLoss?.rate) },
      dailyProfitLoss: { krw: numberValue(overview.dailyProfitLoss?.amount?.krw), usd: numberValue(overview.dailyProfitLoss?.amount?.usd), rate: optionalNumber(overview.dailyProfitLoss?.rate) }
    },
    holdings
  };
}

const server = createServer(async (request, response) => {
  const headers = bridgeHeaders(request);
  if (!headers) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "This local bridge only accepts the configured K_LINE origin." }));
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    response.end();
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405, headers);
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }
  if (request.url === "/health") {
    response.writeHead(200, headers);
    response.end(JSON.stringify({ state: "ready", mode: "read_only_local_bridge" }));
    return;
  }
  if (request.url !== "/portfolio") {
    response.writeHead(404, headers);
    response.end(JSON.stringify({ error: "Not found." }));
    return;
  }
  try {
    const currentPortfolio = await portfolio();
    response.writeHead(200, headers);
    response.end(JSON.stringify({ state: "ready", provider: "Toss Securities", portfolio: currentPortfolio }));
  } catch (error) {
    console.error("Toss local bridge portfolio request failed:", error instanceof Error ? error.message : error);
    response.writeHead(503, headers);
    response.end(JSON.stringify({ state: "unavailable", provider: "Toss Securities", message: "Local Toss bridge could not retrieve portfolio data." }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`K_LINE Toss local bridge is listening at http://${HOST}:${PORT}`);
  console.log("Read-only endpoints: /health, /portfolio");
});
