import type { ColumnMapping, ParsedImportFile } from "@/lib/traditional-liquor/import/real-import-types";
import type { CollectedMarketItem, CollectorResultPayload } from "@/lib/traditional-liquor/collector/types";
import { getCollectorPlatform } from "@/lib/traditional-liquor/collector/platform-registry";

const maxCollectorItems = 1_000;
const acceptedMetricTypes = new Set(["SOURCE_PURCHASE_COUNT", "REVIEW_COUNT", "KEEP_COUNT", "WISH_COUNT", "RATING", "SEARCH_RANK"]);

export function validateCollectorResult(value: unknown): CollectorResultPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_COLLECTOR_PAYLOAD");
  const payload = value as Partial<CollectorResultPayload>;
  const platform = getCollectorPlatform(payload.platformCode);
  if (payload.version !== "1" || !platform || typeof payload.query !== "string" || !payload.query.trim() || !Array.isArray(payload.items)) throw new Error("INVALID_COLLECTOR_PAYLOAD");
  if (payload.items.length > maxCollectorItems) throw new Error("COLLECTOR_ITEM_LIMIT_EXCEEDED");
  if (!payload.diagnostics || payload.diagnostics.platform !== platform.code) throw new Error("INVALID_COLLECTOR_DIAGNOSTICS");
  if (payload.query.trim().length > 120 || !validDate(payload.collectedAt)) throw new Error("INVALID_COLLECTOR_PAYLOAD");
  const allowedMetrics = new Set(platform.metrics.filter((metric) => metric.availability !== "UNAVAILABLE").map((metric) => metric.type));
  for (const item of payload.items) {
    if (!item || !item.identity || !["OFFER", "CATALOG", "PRODUCT"].includes(item.identity.metricScope) || typeof item.identity.sourceEntityId !== "string" || !item.identity.sourceEntityId.trim()) throw new Error("INVALID_COLLECTOR_ITEM");
    if (!item.product || typeof item.product.productName !== "string" || !item.product.productName.trim() || !Array.isArray(item.metrics)) throw new Error("INVALID_COLLECTOR_ITEM");
    if (!item.provenance || item.provenance.platformCode !== platform.code || item.provenance.query.trim() !== payload.query.trim() || !validDate(item.provenance.collectedAt)) throw new Error("INVALID_COLLECTOR_PROVENANCE");
    if (!allowedCollectorUrl(platform.code, item.provenance.sourceUrl) || (item.product.listingUrl && !validHttpsUrl(item.product.listingUrl))) throw new Error("INVALID_COLLECTOR_URL");
    if (item.metrics.some((metric) => !allowedMetrics.has(metric.type) || !Number.isFinite(metric.value) || metric.value < 0 || metric.scope !== item.identity.metricScope || (metric.type !== "RATING" && !Number.isInteger(metric.value)) || (metric.type === "RATING" && metric.value > 5))) throw new Error("INVALID_COLLECTOR_METRIC");
  }
  return payload as CollectorResultPayload;
}

export function collectorResultToParsedImport(payload: CollectorResultPayload) {
  const platform = getCollectorPlatform(payload.platformCode);
  if (!platform) throw new Error("UNKNOWN_COLLECTOR_PLATFORM");
  const objects = payload.items.flatMap((item) => {
    const record = collectedItemToRecord(item, payload);
    return record ? [record] : [];
  });
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  const sourceName = `WooHyukmon Collector · ${platform.displayName} · ${payload.query.trim()}`;
  const parsed: ParsedImportFile = {
    fileType: "JSON",
    fileName: `collector-${platform.code.toLowerCase()}-${Date.now()}.json`,
    importType: "MARKET_OFFER",
    requestedImportType: "MARKET_OFFER",
    detectedImportType: "MARKET_OFFER",
    hasTypeConflict: false,
    typeOverrideApplied: false,
    detectionConfidence: "HIGH",
    detectionReasons: ["Validated WooHyukmon browser collector payload"],
    headers,
    records: objects.map((rawData, index) => ({ importType: "MARKET_OFFER", rowNumber: index + 1, sourceName, rawData }))
  };
  const mapping = Object.fromEntries(headers.map((header) => [header, header])) as ColumnMapping;
  return { parsed, mapping, sourceName, skipped: payload.items.length - objects.length };
}

function collectedItemToRecord(item: CollectedMarketItem, payload: CollectorResultPayload) {
  if (!item || !item.identity?.sourceEntityId || !item.product?.productName || !item.offer || !Number.isFinite(item.offer.benefitPrice ?? item.offer.price)) return null;
  const metrics = new Map(item.metrics.filter((metric) => acceptedMetricTypes.has(metric.type) && Number.isFinite(metric.value) && metric.value >= 0).map((metric) => [metric.type, metric.value]));
  return {
    listing_title: item.product.productName,
    product_name: item.product.productName,
    platform_code: payload.platformCode,
    seller_name: item.product.sellerName || item.product.brandName || null,
    price: item.offer.benefitPrice ?? item.offer.price,
    original_price: item.offer.originalPrice ?? null,
    shipping_fee: item.offer.shippingFee ?? null,
    volume_ml: item.offer.volumeMl ?? null,
    quantity: item.offer.quantity ?? 1,
    source_purchase_count: metrics.get("SOURCE_PURCHASE_COUNT") ?? null,
    keep_count: metrics.get("KEEP_COUNT") ?? null,
    review_count: metrics.get("REVIEW_COUNT") ?? null,
    wish_count: metrics.get("WISH_COUNT") ?? null,
    search_rank: metrics.get("SEARCH_RANK") ?? null,
    rating: metrics.get("RATING") ?? null,
    metric_scope: item.identity.metricScope,
    source_entity_id: item.identity.sourceEntityId,
    external_offer_id: item.identity.externalOfferId ?? item.identity.sourceEntityId,
    listing_url: item.product.listingUrl || item.provenance.sourceUrl,
    query: payload.query,
    collected_at: item.provenance.collectedAt || payload.collectedAt,
    source_name: `WooHyukmon Collector ${payload.platformCode}`
  };
}

function validDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function allowedCollectorUrl(platformCode: "NAVER" | "KAKAO_GIFT", value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return platformCode === "NAVER" ? url.hostname === "naver.com" || url.hostname.endsWith(".naver.com") : url.hostname === "kakao.com" || url.hostname.endsWith(".kakao.com");
  } catch { return false; }
}

function validHttpsUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

export function summarizeCollectorResult(payload: CollectorResultPayload, stagedRows: number, skippedByServer: number) {
  const metricCounts = payload.items.flatMap((item) => item.metrics).reduce<Record<string, number>>((counts, metric) => {
    counts[metric.type] = (counts[metric.type] ?? 0) + 1;
    return counts;
  }, {});
  return {
    products: new Set(payload.items.map((item) => item.product.productName.trim().toLocaleLowerCase())).size,
    offers: stagedRows,
    metrics: metricCounts,
    skipped: payload.diagnostics.skippedItems + skippedByServer
  };
}
