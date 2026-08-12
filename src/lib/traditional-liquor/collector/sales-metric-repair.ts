import "server-only";

import { supabaseRequest } from "@/lib/supabaseServer";

type BatchRow = {
  id: string;
  file_name: string | null;
};

type StagingRow = {
  id: string;
  row_number: number;
  normalized_data: Record<string, unknown>;
  validation_status: "VALID" | "INVALID";
  review_action: string | null;
  resolved_product_id: string | null;
  resolved_seller_id: string | null;
  resolved_platform_id: string | null;
};

type OfferRow = {
  id: string;
  product_id: string;
  platform_id: string;
  seller_id: string;
  source_id: string | null;
  external_offer_id: string | null;
  listing_url: string | null;
};

const recentBatchLimit = 6;

export async function repairRecentNaverPurchaseMetrics() {
  const batches = await supabaseRequest<BatchRow[]>(
    `traditional_liquor_import_batches?select=id,file_name&status=eq.COMPLETED&production_committed_at=not.is.null&order=production_committed_at.desc&limit=${recentBatchLimit}`
  );

  let repaired = 0;
  for (const batch of batches.filter((item) => item.file_name?.startsWith("collector-naver-"))) {
    repaired += await repairNaverPurchaseMetricsForBatch(batch.id);
  }
  return repaired;
}

async function repairNaverPurchaseMetricsForBatch(batchId: string) {
  const rows = await supabaseRequest<StagingRow[]>(
    `traditional_liquor_import_staging_rows?select=id,row_number,normalized_data,validation_status,review_action,resolved_product_id,resolved_seller_id,resolved_platform_id&batch_id=eq.${encodeURIComponent(batchId)}&validation_status=eq.VALID&limit=10000`
  );

  const candidates = rows.filter((row) => {
    if (row.review_action === "EXCLUDE" || !row.resolved_product_id || !row.resolved_seller_id || !row.resolved_platform_id) return false;
    const data = row.normalized_data;
    return data.importType === "MARKET_OFFER"
      && String(data.platformCode ?? "").toUpperCase() === "NAVER"
      && nonNegativeInteger(data.sourcePurchaseCount) !== null;
  });
  if (!candidates.length) return 0;

  const platformIds = [...new Set(candidates.map((row) => row.resolved_platform_id as string))];
  const offers = await supabaseRequest<OfferRow[]>(
    `traditional_liquor_offers?select=id,product_id,platform_id,seller_id,source_id,external_offer_id,listing_url&platform_id=in.(${platformIds.join(",")})&limit=20000`
  );
  if (!offers.length) return 0;

  const byExternalId = new Map(
    offers.filter((offer) => offer.external_offer_id).map((offer) => [`${offer.platform_id}:${offer.external_offer_id}`, offer])
  );
  const byUrl = new Map(
    offers.filter((offer) => offer.listing_url).map((offer) => [`${offer.platform_id}:${offer.listing_url}`, offer])
  );
  const observations = new Map<string, Record<string, unknown>>();

  for (const row of candidates) {
    const data = row.normalized_data;
    const externalOfferId = stringValue(data.externalOfferId);
    const listingUrl = stringValue(data.listingUrl);
    const offer = (externalOfferId ? byExternalId.get(`${row.resolved_platform_id}:${externalOfferId}`) : undefined)
      ?? (listingUrl ? byUrl.get(`${row.resolved_platform_id}:${listingUrl}`) : undefined);
    if (!offer || offer.product_id !== row.resolved_product_id || offer.seller_id !== row.resolved_seller_id) continue;

    const metricValue = nonNegativeInteger(data.sourcePurchaseCount);
    if (metricValue === null) continue;
    const metricScope = validMetricScope(data.metricScope);
    const sourceEntityId = stringValue(data.sourceEntityId)
      ?? externalOfferId
      ?? listingUrl
      ?? offer.id;
    const observedAt = validIsoDate(data.collectedAt);
    const key = `${offer.platform_id}:${metricScope}:${sourceEntityId}:${observedAt}`;

    observations.set(key, {
      offer_id: offer.id,
      product_id: offer.product_id,
      platform_id: offer.platform_id,
      metric_type: "SOURCE_PURCHASE_COUNT",
      metric_value: metricValue,
      observed_at: observedAt,
      source_id: offer.source_id,
      import_batch_id: batchId,
      metric_scope: metricScope,
      source_entity_id: sourceEntityId,
      metadata: { origin: "COLLECTOR_SALES_REPAIR", stagingRowId: row.id, rowNumber: row.row_number }
    });
  }

  const payload = [...observations.values()];
  if (!payload.length) return 0;

  try {
    await supabaseRequest(
      "traditional_liquor_market_metrics_history?on_conflict=platform_id,metric_scope,source_entity_id,metric_type,observed_at",
      { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(payload) }
    );
  } catch {
    const legacyPayload = payload.map(({ metric_scope, source_entity_id, ...observation }) => ({
      ...observation,
      metadata: { ...(observation.metadata as Record<string, unknown>), metricScope: metric_scope, sourceEntityId: source_entity_id }
    }));
    await supabaseRequest(
      "traditional_liquor_market_metrics_history?on_conflict=offer_id,metric_type,observed_at",
      { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(legacyPayload) }
    );
  }

  return payload.length;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nonNegativeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function validIsoDate(value: unknown) {
  const text = stringValue(value);
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : new Date().toISOString();
}

function validMetricScope(value: unknown): "OFFER" | "PRODUCT" | "CATALOG" {
  const scope = stringValue(value)?.toUpperCase();
  return scope === "PRODUCT" || scope === "CATALOG" ? scope : "OFFER";
}
