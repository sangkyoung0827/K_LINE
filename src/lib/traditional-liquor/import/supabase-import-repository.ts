import "server-only";

import type { CollectionQuery } from "@/lib/traditional-liquor/collection/types";
import type { QueryRepository } from "@/lib/traditional-liquor/collection/queries";
import type { CollectionRunRecord, ImportBatchRecord, ImportPreview, StagingRowRecord, TraditionalLiquorImportRepository } from "@/lib/traditional-liquor/import/types";
import { supabaseRequest } from "@/lib/supabaseServer";

type SourceRow = { id: string };
type BatchRow = { id: string; source_id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; started_at: string | null; finished_at: string | null; created_at: string };
type StagingRow = { id: string; batch_id: string; row_number: number; raw_data: StagingRowRecord["rawData"]; normalized_data: StagingRowRecord["normalizedData"]; validation_status: "VALID" | "INVALID"; resolution_status: "UNRESOLVED"; created_at: string };
type ErrorRow = { row_number: number; error_code: ImportPreview["errors"][number]["code"]; field_name: string; error_message: string; raw_value: string | null };
type QueryRow = { id: string; query: string; query_type: CollectionQuery["queryType"]; priority: number; is_active: boolean; last_collected_at: string | null };
type RunRow = { id: string; query_id: string | null; batch_id: string; query_text: string; source_code: string; status: string; offers_found: number; valid_offers: number; invalid_offers: number; started_at: string; finished_at: string | null; error_code: string | null; error_message: string | null };

function toBatch(row: BatchRow): ImportBatchRecord { return { id: row.id, sourceId: row.source_id, status: row.status, totalRows: row.total_rows, validRows: row.valid_rows, invalidRows: row.invalid_rows, startedAt: row.started_at, finishedAt: row.finished_at, createdAt: row.created_at }; }
function toStaging(row: StagingRow): StagingRowRecord { return { id: row.id, batchId: row.batch_id, rowNumber: row.row_number, rawData: row.raw_data, normalizedData: row.normalized_data, validationStatus: row.validation_status, resolutionStatus: row.resolution_status, createdAt: row.created_at }; }
function toQuery(row: QueryRow): CollectionQuery { return { id: row.id, query: row.query, queryType: row.query_type, priority: row.priority, enabled: row.is_active, lastCollectedAt: row.last_collected_at }; }
function toRun(row: RunRow): CollectionRunRecord { return { id: row.id, queryId: row.query_id, batchId: row.batch_id, queryText: row.query_text, sourceCode: row.source_code, status: row.status, offersFound: row.offers_found, validOffers: row.valid_offers, invalidOffers: row.invalid_offers, startedAt: row.started_at, finishedAt: row.finished_at, errorCode: row.error_code, errorMessage: row.error_message }; }
const representationHeaders = { Prefer: "return=representation" };

export class SupabaseTraditionalLiquorImportRepository implements TraditionalLiquorImportRepository, QueryRepository {
  async ensureSource(name: string, sourceType: string, description = "") {
    const existing = await supabaseRequest<SourceRow[]>(`traditional_liquor_data_sources?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
    if (existing[0]) return existing[0].id;
    const rows = await supabaseRequest<SourceRow[]>("traditional_liquor_data_sources", { method: "POST", headers: representationHeaders, body: JSON.stringify({ name, source_type: sourceType, description, is_active: true }) });
    return rows[0].id;
  }

  async createBatch(sourceId: string, startedAt: string) {
    const rows = await supabaseRequest<BatchRow[]>("traditional_liquor_import_batches", { method: "POST", headers: representationHeaders, body: JSON.stringify({ source_id: sourceId, status: "PENDING", started_at: startedAt }) });
    return toBatch(rows[0]);
  }

  async createRun(query: CollectionQuery, batchId: string, sourceCode: string, startedAt: string) {
    const rows = await supabaseRequest<RunRow[]>("traditional_liquor_collection_runs", { method: "POST", headers: representationHeaders, body: JSON.stringify({ query_id: query.id, batch_id: batchId, query_text: query.query, source_code: sourceCode, status: "RUNNING", started_at: startedAt }) });
    return toRun(rows[0]);
  }

  async updateRun(id: string, update: Partial<Pick<CollectionRunRecord, "status" | "offersFound" | "validOffers" | "invalidOffers" | "finishedAt" | "errorCode" | "errorMessage">>) {
    await supabaseRequest(`traditional_liquor_collection_runs?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...(update.status ? { status: update.status } : {}), ...(update.offersFound !== undefined ? { offers_found: update.offersFound } : {}), ...(update.validOffers !== undefined ? { valid_offers: update.validOffers } : {}), ...(update.invalidOffers !== undefined ? { invalid_offers: update.invalidOffers } : {}), ...(update.finishedAt ? { finished_at: update.finishedAt } : {}), ...(update.errorCode ? { error_code: update.errorCode } : {}), ...(update.errorMessage ? { error_message: update.errorMessage } : {}) }) });
  }

  async updateBatch(id: string, update: Partial<Pick<ImportBatchRecord, "status" | "totalRows" | "validRows" | "invalidRows" | "finishedAt">>) {
    const body = { ...(update.status ? { status: update.status } : {}), ...(update.totalRows !== undefined ? { total_rows: update.totalRows } : {}), ...(update.validRows !== undefined ? { valid_rows: update.validRows } : {}), ...(update.invalidRows !== undefined ? { invalid_rows: update.invalidRows } : {}), ...(update.finishedAt ? { finished_at: update.finishedAt } : {}) };
    await supabaseRequest(`traditional_liquor_import_batches?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
  }

  async insertStagingRow(batchId: string, rowNumber: number, offer: Parameters<TraditionalLiquorImportRepository["insertStagingRow"]>[2]) {
    const rows = await supabaseRequest<StagingRow[]>("traditional_liquor_import_staging_rows", { method: "POST", headers: representationHeaders, body: JSON.stringify({ batch_id: batchId, row_number: rowNumber, raw_data: offer.raw, normalized_data: offer.normalized, validation_status: offer.status, resolution_status: "UNRESOLVED" }) });
    return toStaging(rows[0]);
  }

  async insertErrors(batchId: string, stagingRowId: string, rowNumber: number, offer: Parameters<TraditionalLiquorImportRepository["insertErrors"]>[3]) {
    if (!offer.issues.length) return;
    await supabaseRequest("traditional_liquor_import_errors", { method: "POST", body: JSON.stringify(offer.issues.map((item) => ({ batch_id: batchId, staging_row_id: stagingRowId, row_number: rowNumber, error_code: item.code, field_name: item.field, error_message: `${item.severity}: ${item.message}`, raw_value: item.rawValue ?? null, raw_record: offer.raw }))) });
  }

  async listBatches(limit = 20) {
    const rows = await supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 50))}`);
    return rows.map(toBatch);
  }

  async getPreview(batchId: string): Promise<ImportPreview> {
    const encoded = encodeURIComponent(batchId);
    const [batches, runs, rows, errors] = await Promise.all([
      supabaseRequest<BatchRow[]>(`traditional_liquor_import_batches?select=*&id=eq.${encoded}&limit=1`),
      supabaseRequest<RunRow[]>(`traditional_liquor_collection_runs?select=*&batch_id=eq.${encoded}&limit=1`),
      supabaseRequest<StagingRow[]>(`traditional_liquor_import_staging_rows?select=*&batch_id=eq.${encoded}&order=row_number.asc`),
      supabaseRequest<ErrorRow[]>(`traditional_liquor_import_errors?select=row_number,error_code,field_name,error_message,raw_value&batch_id=eq.${encoded}&order=row_number.asc`)
    ]);
    if (!batches[0]) throw new Error("Import batch not found.");
    return { batch: toBatch(batches[0]), run: runs[0] ? toRun(runs[0]) : null, rows: rows.map(toStaging), errors: errors.map((item) => ({ rowNumber: item.row_number, code: item.error_code, field: item.field_name, message: item.error_message, rawValue: item.raw_value, severity: item.error_message.startsWith("WARNING") ? "WARNING" : "ERROR" })) };
  }

  async list() { return (await supabaseRequest<QueryRow[]>("traditional_liquor_collection_queries?select=*&order=priority.desc,query.asc")).map(toQuery); }
  async create(input: Omit<CollectionQuery, "id" | "lastCollectedAt">) {
    const rows = await supabaseRequest<QueryRow[]>("traditional_liquor_collection_queries", { method: "POST", headers: representationHeaders, body: JSON.stringify({ query: input.query.trim(), normalized_query: input.query.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(), query_type: input.queryType, priority: input.priority, is_active: input.enabled }) });
    return toQuery(rows[0]);
  }
  async update(id: string, input: Partial<Pick<CollectionQuery, "priority" | "enabled">>) {
    const rows = await supabaseRequest<QueryRow[]>(`traditional_liquor_collection_queries?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: representationHeaders, body: JSON.stringify({ ...(input.priority !== undefined ? { priority: input.priority } : {}), ...(input.enabled !== undefined ? { is_active: input.enabled } : {}) }) });
    return toQuery(rows[0]);
  }
  async markCollected(id: string, collectedAt: string) { await supabaseRequest(`traditional_liquor_collection_queries?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ last_collected_at: collectedAt }) }); }
}
