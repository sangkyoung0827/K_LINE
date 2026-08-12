import "server-only";

import { applyColumnMapping } from "@/lib/traditional-liquor/import/column-mapping";
import { normalizeSearchText } from "@/lib/traditional-liquor/collection/normalization";
import { resolveImportRow, type AliasEntity, type BreweryEntity, type OfferEntity, type PlatformAliasEntity, type PlatformEntity, type ProductEntity, type ResolutionStatus, type SellerEntity } from "@/lib/traditional-liquor/import/entity-resolution";
import { normalizeRealImportRecord, validateRealImportRecord } from "@/lib/traditional-liquor/import/real-normalization";
import type { ColumnMapping, ParsedImportFile, RealImportType } from "@/lib/traditional-liquor/import/real-import-types";
import { supabaseRequest } from "@/lib/supabaseServer";

const representationHeaders = { Prefer: "return=representation" };
const canonicalPlatforms: Record<string, { name: string; base_url: string; platform_type: string }> = {
  NAVER: { name: "네이버", base_url: "https://shopping.naver.com", platform_type: "MARKETPLACE" },
  KAKAO_GIFT: { name: "카카오톡 선물하기", base_url: "https://gift.kakao.com", platform_type: "MARKETPLACE" }
};
const canonicalPlatformAliases: Record<string, string[]> = {
  KAKAO_GIFT: ["KAKAO_GIFT", "KAKAO", "카카오", "카카오 선물하기", "카카오톡 선물하기", "gift.kakao.com"]
};
type IdRow = { id: string };
type BatchRow = { id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; inserted_rows: number; updated_rows: number; skipped_rows: number; file_name: string | null; import_type: RealImportType | null; created_at: string; discarded_at?: string | null; discard_reason?: string | null; production_committed_at?: string | null };
type CommittedOfferRow = {
  id: string;
  product_id: string;
  platform_id: string;
  source_id: string | null;
  external_offer_id: string | null;
  listing_url: string | null;
};
export type RealStagingRow = { id: string; batch_id: string; row_number: number; raw_data: Record<string, unknown>; normalized_data: Record<string, unknown>; validation_status: "VALID" | "INVALID"; resolution_status: ResolutionStatus; resolved_product_id: string | null; resolved_seller_id: string | null; resolved_platform_id: string | null; resolved_brewery_id: string | null; resolution_data: Record<string, unknown>; review_action: string | null; };
export type { ResolutionStatus } from "@/lib/traditional-liquor/import/entity-resolution";

export interface StageImportResult { batchId: string; total: number; valid: number; invalid: number; }
export interface ResolutionResult { batchId: string; matched: number; newEntity: number; manualReview: number; invalid: number; committable: boolean; }
export interface CommitResult { productsInserted: number; productsUpdated: number; breweriesInserted: number; sellersInserted: number; offersInserted: number; offersUpdated: number; priceHistoryInserted: number; skipped: number; batchId: string; }

export class RealImportRepository {
  private async ensureCanonicalPlatforms(rows: RealStagingRow[]) {
    const requestedCodes = new Set(
      rows
        .filter((row) => row.validation_status === "VALID" && row.normalized_data.importType === "MARKET_OFFER")
        .map((row) => String(row.normalized_data.platformCode ?? "").trim().toUpperCase())
        .filter((code) => code in canonicalPlatforms)
    );
    if (!requestedCodes.size) return;

    await supabaseRequest("traditional_liquor_platforms?on_conflict=code", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([...requestedCodes].map((code) => ({
        code,
        ...canonicalPlatforms[code],
        is_active: true
      })))
    });

    const platforms = await supabaseRequest<PlatformEntity[]>(`traditional_liquor_platforms?select=id,code,name&code=in.(${[...requestedCodes].map(encodeURIComponent).join(",")})`);
    const aliases = platforms.flatMap((platform) => (canonicalPlatformAliases[platform.code] ?? []).map((alias) => ({
      platform_id: platform.id,
      alias_name: alias,
      normalized_alias: normalizeSearchText(alias),
      is_active: true
    })));
    if (aliases.length) {
      await supabaseRequest("traditional_liquor_platform_aliases?on_conflict=normalized_alias", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(aliases)
      }).catch((error) => {
        console.warn("Platform alias seed is unavailable until the KAKAO_GIFT migration is applied.", error);
      });
    }
  }

  async ensureSource(name: string, sourceType: string, baseUrl?: string | null) {
    const existing = await supabaseRequest<IdRow[]>(`traditional_liquor_data_sources?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
    if (existing[0]) return existing[0].id;
    const rows = await supabaseRequest<IdRow[]>("traditional_liquor_data_sources", { method: "POST", headers: representationHeaders, body: JSON.stringify({ name, source_type: sourceType, base_url: baseUrl || null, description: "Traditional Liquor Real Data Import V2", is_active: true }) });
    return rows[0].id;
  }

  async stageFile(parsed: ParsedImportFile, mapping: ColumnMapping, sourceName: string, observedAt?: string | null, sourceType?: "MANUAL" | "CSV" | "XLSX" | "COLLECTOR"): Promise<StageImportResult> {
    const sourceId = await this.ensureSource(sourceName, sourceType ?? (parsed.fileType === "JSON" ? "MANUAL" : parsed.fileType));
    const batches = await supabaseRequest<BatchRow[]>("traditional_liquor_import_batches", { method: "POST", headers: representationHeaders, body: JSON.stringify({ source_id: sourceId, file_name: parsed.fileName, import_type: parsed.importType, mapping_data: mapping, status: "PARSING", started_at: new Date().toISOString() }) });
    const batchId = batches[0].id;
    try {
      const staged: Array<Record<string, unknown>> = [];
      const errors: Array<Record<string, unknown>> = [];
      let valid = 0;
      let invalid = 0;
      for (const record of parsed.records) {
        const mapped = applyColumnMapping(record, mapping, sourceName);
        const normalized = normalizeRealImportRecord(mapped);
        if (observedAt && normalized.importType === "MARKET_OFFER") normalized.collectedAt = observedAt;
        const validation = validateRealImportRecord(normalized);
        if (validation.status === "VALID") valid += 1; else invalid += 1;
        staged.push({ batch_id: batchId, row_number: record.rowNumber, raw_data: { importType: record.importType, sourceName: mapped.sourceName, rawData: record.rawData, mappedData: mapped.mappedData }, normalized_data: normalized, validation_status: validation.status, resolution_status: "UNRESOLVED", resolution_data: {} });
        validation.issues.forEach((issue) => errors.push({ batch_id: batchId, row_number: record.rowNumber, error_code: issue.code, field_name: issue.field, error_message: `${issue.severity}: ${issue.message}`, raw_value: issue.rawValue ?? null, raw_record: record.rawData }));
      }
      if (staged.length) await supabaseRequest("traditional_liquor_import_staging_rows", { method: "POST", body: JSON.stringify(staged) });
      if (errors.length) await supabaseRequest("traditional_liquor_import_errors", { method: "POST", body: JSON.stringify(errors) });
      await supabaseRequest(`traditional_liquor_import_batches?id=eq.${encodeURIComponent(batchId)}`, { method: "PATCH", body: JSON.stringify({ status: "READY", total_rows: staged.length, valid_rows: valid, invalid_rows: invalid, finished_at: new Date().toISOString() }) });
      return { batchId, total: staged.length, valid, invalid };
    } catch (error) {
      await supabaseRequest(`traditional_liquor_import_batches?id=eq.${encodeURIComponent(batchId)}`, { method: "PATCH", body: JSON.stringify({ status: "FAILED", finished_at: new Date().toISOString() }) }).catch(() => undefined);
      throw error;
    }
  }

  async listRealBatches(limit = 30) {
    return supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&import_type=not.is.null&order=created_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`);
  }

  async getRows(batchId: string) {
    return supabaseRequest<RealStagingRow[]>(`traditional_liquor_import_staging_rows?select=*&batch_id=eq.${encodeURIComponent(batchId)}&order=row_number.asc&limit=10000`);
  }

  async listPlatforms() {
    return supabaseRequest<PlatformEntity[]>("traditional_liquor_platforms?select=id,code,name&is_active=eq.true&order=name.asc&limit=1000");
  }

  async discardBatch(batchId: string, reason?: string | null) {
    return supabaseRequest<{ batchId: string; discarded: boolean; productionCommitted: boolean }>("rpc/discard_traditional_liquor_import_batch", { method: "POST", body: JSON.stringify({ p_batch_id: batchId, p_reason: reason?.trim().slice(0, 500) || null }) });
  }

  async permanentlyDeleteBatch(batchId: string) {
    return supabaseRequest<{ batchId: string; deleted: boolean; stagingRowsDeleted: number; errorsDeleted: number }>("rpc/delete_uncommitted_traditional_liquor_import_batch", { method: "POST", body: JSON.stringify({ p_batch_id: batchId }) });
  }

  async resolveBatch(batchId: string): Promise<ResolutionResult> {
    const batches = await supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&id=eq.${encodeURIComponent(batchId)}&limit=1`);
    if (!batches[0]) throw new Error("IMPORT_BATCH_NOT_FOUND");
    if (batches[0].status === "DISCARDED") throw new Error("BATCH_DISCARDED");
    if (batches[0].status !== "READY") throw new Error("BATCH_NOT_READY");
    const rows = await this.getRows(batchId);
    await this.ensureCanonicalPlatforms(rows);
    const [products, breweries, sellers, platforms, offers, storedPlatformAliases, productAliases, sellerAliases] = await Promise.all([
      supabaseRequest<ProductEntity[]>("traditional_liquor_products?select=id,brewery_id,name,canonical_name,normalized_name,abv,volume_ml&is_active=eq.true&limit=10000"),
      supabaseRequest<BreweryEntity[]>("traditional_liquor_breweries?select=id,name,normalized_name,region,province,city&is_active=eq.true&limit=10000"),
      supabaseRequest<SellerEntity[]>("traditional_liquor_sellers?select=id,name,normalized_name&is_active=eq.true&limit=10000"),
      supabaseRequest<PlatformEntity[]>("traditional_liquor_platforms?select=id,code,name&is_active=eq.true&limit=1000"),
      supabaseRequest<OfferEntity[]>("traditional_liquor_offers?select=id,product_id,platform_id,seller_id,external_offer_id,listing_url&limit=20000"),
      supabaseRequest<PlatformAliasEntity[]>("traditional_liquor_platform_aliases?select=platform_id,alias_name,normalized_alias&is_active=eq.true&limit=5000").catch(() => []),
      supabaseRequest<AliasEntity[]>("traditional_liquor_product_aliases?select=product_id,normalized_alias&limit=20000"),
      supabaseRequest<AliasEntity[]>("traditional_liquor_seller_aliases?select=seller_id,normalized_alias&limit=20000")
    ]);
    const builtInPlatformAliases = platforms.flatMap((platform) => (canonicalPlatformAliases[platform.code] ?? []).map((alias) => ({ platform_id: platform.id, alias_name: alias, normalized_alias: normalizeSearchText(alias) })));
    const platformAliases = [...storedPlatformAliases, ...builtInPlatformAliases];
    let matched = 0, newEntity = 0, manualReview = 0, invalid = 0;
    for (const row of rows) {
      if (row.validation_status === "INVALID") { invalid += 1; continue; }
      const data = row.normalized_data;
      const resolution = resolveImportRow(data, { products, breweries, sellers, platforms, offers, platformAliases, productAliases, sellerAliases });
      if (resolution.status === "MATCHED") matched += 1;
      if (resolution.status === "NEW_ENTITY") newEntity += 1;
      if (resolution.status === "MANUAL_REVIEW") manualReview += 1;
      await supabaseRequest(`traditional_liquor_import_staging_rows?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ resolution_status: resolution.status, resolved_product_id: resolution.productId, resolved_seller_id: resolution.sellerId, resolved_platform_id: resolution.platformId, resolved_brewery_id: resolution.breweryId, resolution_data: resolution.details, review_action: null }) });
    }
    return { batchId, matched, newEntity, manualReview, invalid, committable: manualReview === 0 && rows.length > invalid };
  }

  async assignPlatformToBatch(batchId: string, platformId: string) {
    const [batches, platforms] = await Promise.all([
      supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&id=eq.${encodeURIComponent(batchId)}&limit=1`),
      supabaseRequest<PlatformEntity[]>(`traditional_liquor_platforms?select=id,code,name&id=eq.${encodeURIComponent(platformId)}&is_active=eq.true&limit=1`)
    ]);
    const batch = batches[0];
    const platform = platforms[0];
    if (!batch) throw new Error("IMPORT_BATCH_NOT_FOUND");
    if (batch.status !== "READY" || batch.import_type !== "MARKET_OFFER") throw new Error("BATCH_NOT_READY");
    if (!platform) throw new Error("PLATFORM_NOT_FOUND");
    return supabaseRequest<{ batchId: string; platformId: string; platformCode: string; appliedRows: number }>(
      "rpc/assign_traditional_liquor_batch_platform",
      { method: "POST", body: JSON.stringify({ p_batch_id: batchId, p_platform_id: platform.id }) }
    );
  }

  async reviewRow(rowId: string, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids: { productId?: string | null; sellerId?: string | null; platformId?: string | null; breweryId?: string | null }) {
    const rows = await supabaseRequest<RealStagingRow[]>(`traditional_liquor_import_staging_rows?select=*&id=eq.${encodeURIComponent(rowId)}&limit=1`);
    if (!rows[0]) throw new Error("STAGING_ROW_NOT_FOUND");
    const batches = await supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&id=eq.${encodeURIComponent(rows[0].batch_id)}&limit=1`);
    if (!batches[0]) throw new Error("IMPORT_BATCH_NOT_FOUND");
    if (batches[0].status === "DISCARDED") throw new Error("BATCH_DISCARDED");
    const importType = String(rows[0].normalized_data.importType);
    if (action === "LINK_EXISTING" && !ids.productId) throw new Error("PRODUCT_LINK_REQUIRED");
    if (importType === "MARKET_OFFER" && action !== "EXCLUDE" && !ids.platformId && !rows[0].resolved_platform_id) throw new Error("PLATFORM_LINK_REQUIRED");
    if (importType === "MARKET_OFFER" && action === "LINK_EXISTING" && !ids.sellerId) throw new Error("SELLER_LINK_REQUIRED");
    const status = action === "CREATE_NEW" ? "NEW_ENTITY" : "MATCHED";
    await supabaseRequest(`traditional_liquor_import_staging_rows?id=eq.${encodeURIComponent(rowId)}`, { method: "PATCH", body: JSON.stringify({ resolution_status: status, review_action: action, ...(ids.productId ? { resolved_product_id: ids.productId } : {}), ...(ids.sellerId ? { resolved_seller_id: ids.sellerId } : {}), ...(ids.platformId ? { resolved_platform_id: ids.platformId } : {}), ...(ids.breweryId ? { resolved_brewery_id: ids.breweryId } : {}) }) });
  }

  async commitBatch(batchId: string): Promise<CommitResult> {
    const result = await supabaseRequest<CommitResult>("rpc/commit_traditional_liquor_import_batch", { method: "POST", body: JSON.stringify({ p_batch_id: batchId }) });
    await this.captureCommittedMarketMetrics(batchId).catch((error) => {
      // The database trigger is authoritative; this fallback keeps older deployments collecting snapshots.
      console.error("Traditional liquor metric snapshot fallback failed.", error);
    });
    return result;
  }

  private async captureCommittedMarketMetrics(batchId: string) {
    const [rows, offers] = await Promise.all([
      this.getRows(batchId),
      supabaseRequest<CommittedOfferRow[]>(
        `traditional_liquor_offers?select=id,product_id,platform_id,source_id,external_offer_id,listing_url&import_batch_id=eq.${encodeURIComponent(batchId)}&limit=10000`
      )
    ]);
    if (!rows.length || !offers.length) return;

    const byExternalId = new Map(offers.filter((offer) => offer.external_offer_id).map((offer) => [`${offer.platform_id}:${offer.external_offer_id}`, offer]));
    const byUrl = new Map(offers.filter((offer) => offer.listing_url).map((offer) => [`${offer.platform_id}:${offer.listing_url}`, offer]));
    const observations = new Map<string, Record<string, unknown>>();
    const metricFields = [
      ["sourcePurchaseCount", "SOURCE_PURCHASE_COUNT"], ["keepCount", "KEEP_COUNT"],
      ["reviewCount", "REVIEW_COUNT"], ["wishCount", "WISH_COUNT"],
      ["searchRank", "SEARCH_RANK"], ["giftRank", "GIFT_RANK"],
      ["categoryRank", "CATEGORY_RANK"]
    ] as const;

    for (const row of rows) {
      if (row.validation_status !== "VALID" || row.normalized_data.importType !== "MARKET_OFFER" || !row.resolved_platform_id) continue;
      const externalOfferId = stringValue(row.normalized_data.externalOfferId);
      const listingUrl = stringValue(row.normalized_data.listingUrl);
      const offer = (externalOfferId ? byExternalId.get(`${row.resolved_platform_id}:${externalOfferId}`) : undefined)
        ?? (listingUrl ? byUrl.get(`${row.resolved_platform_id}:${listingUrl}`) : undefined);
      if (!offer) continue;

      const observedAt = validIsoDate(row.normalized_data.collectedAt);
      const metricScope = validMetricScope(row.normalized_data.metricScope);
      const sourceEntityId = stringValue(row.normalized_data.sourceEntityId)
        ?? (metricScope === "OFFER" ? externalOfferId ?? listingUrl ?? offer.id : offer.product_id);

      for (const [field, metricType] of metricFields) {
        const metricValue = integerValue(row.normalized_data[field]);
        if (metricValue === null) continue;
        const key = `${offer.platform_id}:${metricScope}:${sourceEntityId}:${metricType}:${observedAt}`;
        observations.set(key, {
          offer_id: offer.id,
          product_id: offer.product_id,
          platform_id: offer.platform_id,
          metric_type: metricType,
          metric_value: metricValue,
          observed_at: observedAt,
          source_id: offer.source_id,
          import_batch_id: batchId,
          metric_scope: metricScope,
          source_entity_id: sourceEntityId,
          metadata: { origin: "REAL_IMPORT_V2", rowNumber: row.row_number }
        });
      }
    }

    const payload = [...observations.values()];
    if (!payload.length) return;
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
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function validIsoDate(value: unknown) {
  const text = stringValue(value);
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : new Date().toISOString();
}

function validMetricScope(value: unknown): "OFFER" | "PRODUCT" | "CATALOG" {
  const scope = stringValue(value)?.toUpperCase();
  return scope === "PRODUCT" || scope === "CATALOG" ? scope : "OFFER";
}
