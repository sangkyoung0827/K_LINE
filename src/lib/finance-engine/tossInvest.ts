import "server-only";

const TOSS_INVEST_BASE_URL = "https://openapi.tossinvest.com";

type TossEnvelope<T> = { result: T };

type TossAccount = {
  accountNo?: string;
  accountSeq: number;
  accountType?: string;
};

type TossHolding = {
  symbol: string;
  name: string;
  marketCountry: "KR" | "US";
  currency: "KRW" | "USD";
  quantity: string;
  lastPrice: string;
  averagePurchasePrice: string;
  marketValue: { amount: string; amountAfterCost?: string; purchaseAmount?: string };
  profitLoss: { amount: string; amountAfterCost?: string; rate?: string };
  dailyProfitLoss?: { amount: string; rate?: string };
};

type TossHoldingsOverview = {
  totalPurchaseAmount?: { krw?: string; usd?: string };
  marketValue?: { amount?: { krw?: string; usd?: string }; amountAfterCost?: { krw?: string; usd?: string } };
  profitLoss?: { amount?: { krw?: string; usd?: string }; amountAfterCost?: { krw?: string; usd?: string }; rate?: string; rateAfterCost?: string };
  dailyProfitLoss?: { amount?: { krw?: string; usd?: string }; rate?: string };
  items?: TossHolding[];
};

export type TossPortfolio = {
  account: { sequence: number; type: string; maskedNumber: string | null };
  asOf: string;
  totals: {
    marketValue: { krw: number; usd: number };
    purchaseAmount: { krw: number; usd: number };
    profitLoss: { krw: number; usd: number; rate: number | null };
    dailyProfitLoss: { krw: number; usd: number; rate: number | null };
  };
  holdings: Array<{
    symbol: string;
    name: string;
    marketCountry: "KR" | "US";
    currency: "KRW" | "USD";
    quantity: number;
    lastPrice: number;
    averagePurchasePrice: number;
    marketValue: number;
    profitLoss: number;
    profitLossRate: number | null;
    dailyProfitLoss: number | null;
    allocationPercent: number | null;
  }>;
};

type CachedToken = { expiresAt: number; value: string };
let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

export class TossInvestConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TossInvestConfigurationError";
  }
}

export class TossInvestApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "TossInvestApiError";
  }
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maskedAccountNumber(value: string | undefined) {
  if (!value || value.length < 4) return null;
  return `••••${value.slice(-4)}`;
}

function configuration() {
  // Keep the first integration's TOSS_CLIENT_* names compatible with the
  // finance-specific aliases. Neither value is ever returned to the client.
  const clientId = process.env.TOSSINVEST_CLIENT_ID?.trim() || process.env.TOSS_CLIENT_ID?.trim();
  const clientSecret = process.env.TOSSINVEST_CLIENT_SECRET?.trim() || process.env.TOSS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new TossInvestConfigurationError("Toss Securities is not configured. Add TOSSINVEST_CLIENT_ID and TOSSINVEST_CLIENT_SECRET on the server.");
  }
  return { clientId, clientSecret };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } | string; error_description?: string };
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    return body.error_description || message || `Toss Securities returned HTTP ${response.status}.`;
  } catch {
    return `Toss Securities returned HTTP ${response.status}.`;
  }
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const { clientId, clientSecret } = configuration();
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
    const response = await fetch(`${TOSS_INVEST_BASE_URL}/oauth2/token`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    if (!response.ok) throw new TossInvestApiError(await readError(response), response.status);
    const token = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new TossInvestApiError("Toss Securities did not return an access token.", 502);
    cachedToken = { value: token.access_token, expiresAt: Date.now() + Math.max(60, Number(token.expires_in) || 0) * 1000 };
    return cachedToken.value;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function requestToss<T>(path: string, accountSequence?: number): Promise<T> {
  const send = async (retry: boolean): Promise<T> => {
    const accessToken = await getAccessToken();
    const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
    if (accountSequence !== undefined) headers.set("X-Tossinvest-Account", String(accountSequence));
    const response = await fetch(`${TOSS_INVEST_BASE_URL}${path}`, { cache: "no-store", headers });
    if (response.status === 401 && retry) {
      cachedToken = null;
      return send(false);
    }
    if (!response.ok) throw new TossInvestApiError(await readError(response), response.status);
    const body = (await response.json()) as TossEnvelope<T>;
    return body.result;
  };
  return send(true);
}

export function isTossInvestConfigured() {
  return Boolean(
    (process.env.TOSSINVEST_CLIENT_ID?.trim() || process.env.TOSS_CLIENT_ID?.trim()) &&
    (process.env.TOSSINVEST_CLIENT_SECRET?.trim() || process.env.TOSS_CLIENT_SECRET?.trim())
  );
}

export async function getTossPortfolio(): Promise<TossPortfolio> {
  const accounts = await requestToss<TossAccount[]>("/api/v1/accounts");
  const configuredSequence = optionalNumber(process.env.TOSSINVEST_ACCOUNT_SEQ);
  const account = configuredSequence === null ? accounts[0] : accounts.find((item) => item.accountSeq === configuredSequence);
  if (!account) throw new TossInvestApiError("No eligible Toss Securities brokerage account was found.", 404);

  const overview = await requestToss<TossHoldingsOverview>("/api/v1/holdings", account.accountSeq);
  const totalKrw = numberValue(overview.marketValue?.amount?.krw);
  const totalUsd = numberValue(overview.marketValue?.amount?.usd);
  const holdings = (overview.items ?? []).map((item) => {
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
