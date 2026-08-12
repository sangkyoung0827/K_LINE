type MetricScope = "OFFER" | "CATALOG" | "PRODUCT";
type CollectorMetric = { type: string; value: number; scope: MetricScope };
type MarketItem = {
  identity: { externalOfferId?: string; sourceEntityId: string; metricScope: MetricScope };
  product: { productName: string; sellerName?: string; brandName?: string; listingUrl?: string };
  offer?: { price?: number; originalPrice?: number; benefitPrice?: number; shippingFee?: number; volumeMl?: number; quantity?: number };
  metrics: CollectorMetric[];
  provenance: { platformCode: "NAVER" | "KAKAO_GIFT"; query: string; sourceUrl: string; collectedAt: string; collectorVersion: string };
};
type CollectorPayload = { version: "1"; platformCode: "NAVER" | "KAKAO_GIFT"; query: string; collectedAt: string; items: MarketItem[]; diagnostics: Record<string, unknown> };

function compactNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return undefined;
  const text = value.replace(/,/g, "").trim();
  const match = text.match(/([\d.]+)\s*(만|천)?/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  return Math.max(0, Math.round(amount * (match[2] === "만" ? 10000 : match[2] === "천" ? 1000 : 1)));
}

function textOf(root: ParentNode, selectors: string[]) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function absoluteUrl(value: string | null | undefined) {
  if (!value) return location.href;
  try { return new URL(value, location.href).href; } catch { return location.href; }
}
