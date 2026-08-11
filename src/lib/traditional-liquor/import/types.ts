import type { CollectionQuery, ValidatedOffer, ValidationIssue } from "@/lib/traditional-liquor/collection/types";

export interface ImportBatchRecord { id: string; sourceId: string; status: string; totalRows: number; validRows: number; invalidRows: number; startedAt: string | null; finishedAt: string | null; createdAt: string; }
export interface CollectionRunRecord { id: string; queryId: string | null; batchId: string; queryText: string; sourceCode: string; status: string; offersFound: number; validOffers: number; invalidOffers: number; startedAt: string; finishedAt: string | null; errorCode: string | null; errorMessage: string | null; }
export interface StagingRowRecord { id: string; batchId: string; rowNumber: number; rawData: ValidatedOffer["raw"]; normalizedData: ValidatedOffer["normalized"]; validationStatus: "VALID" | "INVALID"; resolutionStatus: "UNRESOLVED"; createdAt: string; }
export interface ImportPreview { batch: ImportBatchRecord; run?: CollectionRunRecord | null; query?: CollectionQuery | null; rows: StagingRowRecord[]; errors: Array<ValidationIssue & { rowNumber: number }>; }

export interface TraditionalLiquorImportRepository {
  ensureSource(name: string, sourceType: string, description?: string): Promise<string>;
  createBatch(sourceId: string, startedAt: string): Promise<ImportBatchRecord>;
  createRun(query: CollectionQuery, batchId: string, sourceCode: string, startedAt: string): Promise<CollectionRunRecord>;
  updateRun(id: string, update: Partial<Pick<CollectionRunRecord, "status" | "offersFound" | "validOffers" | "invalidOffers" | "finishedAt" | "errorCode" | "errorMessage">>): Promise<void>;
  updateBatch(id: string, update: Partial<Pick<ImportBatchRecord, "status" | "totalRows" | "validRows" | "invalidRows" | "finishedAt">>): Promise<void>;
  insertStagingRow(batchId: string, rowNumber: number, offer: ValidatedOffer): Promise<StagingRowRecord>;
  insertErrors(batchId: string, stagingRowId: string, rowNumber: number, offer: ValidatedOffer): Promise<void>;
  listBatches(limit?: number): Promise<ImportBatchRecord[]>;
  getPreview(batchId: string): Promise<ImportPreview>;
}
