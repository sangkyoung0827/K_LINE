import "server-only";

import { applyColumnMapping } from "@/lib/traditional-liquor/import/column-mapping";
import { resolveImportRow, type AliasEntity, type BreweryEntity, type PlatformEntity, type ProductEntity, type ResolutionStatus, type SellerEntity } from "@/lib/traditional-liquor/import/entity-resolution";
import { normalizeRealImportRecord, validateRealImportRecord } from "@/lib/traditional-liquor/import/real-normalization";
import type { ColumnMapping, ParsedImportFile, RealImportType } from "@/lib/traditional-liquor/import/real-import-types";
import { supabaseRequest } from "@/lib/supabaseServer";

const representationHeaders = { Prefer: "return=representation" };
const canonicalPlatforms: Record<string, { name: string; base_url: string; platform_type: string }> = {
  NAVER: { name: "네이버", base_url: "https://shopping.naver.com", platform_type: "MARKETPLACE" }
};
type IdRow = { id: string };
type BatchRow = { id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; inserted_rows: number; updated_rows: number; skipped_rows: number; file_name: string | null; import_type: RealImportType | null; created_at: string; discarded_at?: string | null; discard_reason?: string | null; production_committed_at?: string | null };
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
  }

  async ensureSource(name: string, sourceType: string, baseUrl?: string | null) {
    const existing = await supabaseRequest<IdRow[]>(`traditional_liquor_data_sources?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
    if (existing[0]) return existing[0].id;
    const rows = await supabaseRequest<IdRow[]>("traditional_liquor_data_sources", { method: "POST", headers: representationHeaders, body: JSON.stringify({ name, source_type: sourceType, base_url: baseUrl || null, description: "Traditional Liquor Real Data Import V2", is_active: true }) });
    return rows[0].id;
  }

  async stageFile(parsed: ParsedImportFile, mapping: ColumnMapping, sourceName: string, observedAt?: string | null): Promise<StageImportResult> {
    const sourceId = await this.ensureSource(sourceName, parsed.fileType === "JSON" ? "MANUAL" : parsed.fileType);
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
    const [products, breweries, sellers, platforms, productAliases, sellerAliases] = await Promise.all([
      supabaseRequest<ProductEntity[]>("traditional_liquor_products?select=id,brewery_id,name,canonical_name,normalized_name,abv,volume_ml&is_active=eq.true&limit=10000"),
      supabaseRequest<BreweryEntity[]>("traditional_liquor_breweries?select=id,name,normalized_name,region,province,city&is_active=eq.true&limit=10000"),
      supabaseRequest<SellerEntity[]>("traditional_liquor_sellers?select=id,name,normalized_name&is_active=eq.true&limit=10000"),
      supabaseRequest<PlatformEntity[]>("traditional_liquor_platforms?select=id,code,name&is_active=eq.true&limit=1000"),
      supabaseRequest<AliasEntity[]>("traditional_liquor_product_aliases?select=product_id,normalized_alias&limit=20000"),
      supabaseRequest<AliasEntity[]>("traditional_liquor_seller_aliases?select=seller_id,normalized_alias&limit=20000")
    ]);
    let matched = 0, newEntity = 0, manualReview = 0, invalid = 0;
    for (const row of rows) {
      if (row.validation_status === "INVALID") { invalid += 1; continue; }
      const data = row.normalized_data;
      const resolution = resolveImportRow(data, { products, breweries, sellers, platforms, productAliases, sellerAliases });
      if (resolution.status === "MATCHED") matched += 1;
      if (resolution.status === "NEW_ENTITY") newEntity += 1;
      if (resolution.status === "MANUAL_REVIEW") manualReview += 1;
      await supabaseRequest(`traditional_liquor_import_staging_rows?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify({ resolution_status: resolution.status, resolved_product_id: resolution.productId, resolved_seller_id: resolution.sellerId, resolved_platform_id: resolution.platformId, resolved_brewery_id: resolution.breweryId, resolution_data: resolution.details, review_action: null }) });
    }
    return { batchId, matched, newEntity, manualReview, invalid, committable: manualReview === 0 && rows.length > invalid };
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
    return supabaseRequest<CommitResult>("rpc/commit_traditional_liquor_import_batch", { method: "POST", body: JSON.stringify({ p_batch_id: batchId }) });
  }
}
