import "server-only";

import type { CollectorDiagnostics, CollectorJobPublic, CollectorJobStatus } from "@/lib/traditional-liquor/collector/types";
import type { CollectorPlatformCode } from "@/lib/traditional-liquor/collector/platform-registry";
import { supabaseRequest } from "@/lib/supabaseServer";

type CollectorJobRow = {
  id: string;
  requested_by: string;
  platform_code: CollectorPlatformCode;
  query: string;
  status: CollectorJobStatus;
  token_hash: string;
  target_url: string;
  expires_at: string;
  batch_id: string | null;
  diagnostics: CollectorDiagnostics | null;
  result_summary: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

const representationHeaders = { Prefer: "return=representation" };

export class CollectorJobRepository {
  async create(input: { requestedBy: string; platformCode: CollectorPlatformCode; query: string; targetUrl: string; tokenHash: string; expiresAt: string }) {
    const rows = await supabaseRequest<CollectorJobRow[]>("traditional_liquor_collector_jobs", {
      method: "POST",
      headers: representationHeaders,
      body: JSON.stringify({
        requested_by: input.requestedBy,
        platform_code: input.platformCode,
        query: input.query,
        target_url: input.targetUrl,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        status: "PENDING"
      })
    });
    return rows[0];
  }

  async get(id: string) {
    const rows = await supabaseRequest<CollectorJobRow[]>(`traditional_liquor_collector_jobs?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0] ?? null;
  }

  async update(id: string, update: Partial<{ status: CollectorJobStatus; batchId: string | null; diagnostics: CollectorDiagnostics; resultSummary: Record<string, unknown>; errorMessage: string | null; startedAt: string; finishedAt: string }>) {
    const rows = await supabaseRequest<CollectorJobRow[]>(`traditional_liquor_collector_jobs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: representationHeaders,
      body: JSON.stringify({
        ...(update.status ? { status: update.status } : {}),
        ...(update.batchId !== undefined ? { batch_id: update.batchId } : {}),
        ...(update.diagnostics ? { diagnostics: update.diagnostics } : {}),
        ...(update.resultSummary ? { result_summary: update.resultSummary } : {}),
        ...(update.errorMessage !== undefined ? { error_message: update.errorMessage } : {}),
        ...(update.startedAt ? { started_at: update.startedAt } : {}),
        ...(update.finishedAt ? { finished_at: update.finishedAt } : {})
      })
    });
    return rows[0] ?? null;
  }

  async claimForUpload(id: string) {
    const rows = await supabaseRequest<CollectorJobRow[]>(`traditional_liquor_collector_jobs?id=eq.${encodeURIComponent(id)}&status=eq.RUNNING`, {
      method: "PATCH",
      headers: representationHeaders,
      body: JSON.stringify({ status: "UPLOADING" })
    });
    return rows[0] ?? null;
  }
}

export function toPublicCollectorJob(row: CollectorJobRow): CollectorJobPublic {
  return {
    id: row.id,
    platformCode: row.platform_code,
    query: row.query,
    status: row.status,
    targetUrl: row.target_url,
    expiresAt: row.expires_at,
    batchId: row.batch_id,
    diagnostics: row.diagnostics,
    resultSummary: row.result_summary ?? {},
    errorMessage: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}
