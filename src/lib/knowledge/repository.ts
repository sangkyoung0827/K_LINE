import "server-only";

import { supabaseRequest } from "@/lib/supabaseServer";
import type { KnowledgeAnalysis, KnowledgeFileRow, KnowledgeStatus } from "@/lib/knowledge/types";

const fileColumns =
  "id,original_name,storage_path,mime_type,extension,size_bytes,sha256,uploaded_by,uploaded_at,processing_status,processing_error,parser_type,extracted_text,ai_summary,ai_description,document_type,organization,event,location,document_date,confidence,metadata,created_at,updated_at";

export type KnowledgeChunkRow = {
  id: string;
  file_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  metadata: Record<string, unknown>;
  embedding_provider: string | null;
  embedding_model: string | null;
  created_at: string;
};

export type KnowledgeJobRow = {
  id: string;
  file_id: string;
  stage: string;
  status: "STARTED" | "COMPLETED" | "FAILED";
  attempt_count: number;
  error: string | null;
  details: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
};

function encoded(value: string) {
  return encodeURIComponent(value);
}

export async function findKnowledgeFileByHash(sha256: string) {
  const rows = await supabaseRequest<KnowledgeFileRow[]>(
    `knowledge_files?select=${fileColumns}&sha256=eq.${encoded(sha256)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function getKnowledgeFile(fileId: string) {
  const rows = await supabaseRequest<KnowledgeFileRow[]>(
    `knowledge_files?select=${fileColumns}&id=eq.${encoded(fileId)}&limit=1`
  );
  return rows[0] ?? null;
}

export async function createKnowledgeFile(input: {
  extension: string;
  mimeType: string;
  originalName: string;
  sha256: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
}) {
  const rows = await supabaseRequest<KnowledgeFileRow[]>(
    `knowledge_files?select=${fileColumns}`,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        extension: input.extension,
        mime_type: input.mimeType,
        original_name: input.originalName,
        processing_status: "UPLOADED",
        sha256: input.sha256,
        size_bytes: input.sizeBytes,
        storage_path: input.storagePath,
        uploaded_by: input.uploadedBy
      })
    }
  );
  return rows[0];
}

export async function listKnowledgeFiles(options: {
  limit?: number;
  query?: string;
  status?: string;
} = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const filters = [`select=${fileColumns}`, "order=uploaded_at.desc", `limit=${limit}`];
  if (options.status && options.status !== "ALL") {
    filters.push(`processing_status=eq.${encoded(options.status)}`);
  }
  if (options.query) {
    const q = options.query.replace(/[,*()]/g, " ").trim().slice(0, 120);
    if (q) filters.push(`or=(original_name.ilike.*${encoded(q)}*,ai_summary.ilike.*${encoded(q)}*)`);
  }
  return supabaseRequest<KnowledgeFileRow[]>(`knowledge_files?${filters.join("&")}`);
}

export async function updateKnowledgeFile(
  fileId: string,
  patch: Partial<{
    ai_description: string;
    ai_summary: string;
    confidence: number;
    document_date: string | null;
    document_type: string;
    event: string;
    extracted_text: string;
    location: string;
    metadata: Record<string, unknown>;
    organization: string;
    parser_type: string;
    processing_error: string | null;
    processing_status: KnowledgeStatus;
  }>
) {
  const rows = await supabaseRequest<KnowledgeFileRow[]>(
    `knowledge_files?id=eq.${encoded(fileId)}&select=${fileColumns}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    }
  );
  return rows[0] ?? null;
}

export async function removeKnowledgeFileRecord(fileId: string) {
  await supabaseRequest(`knowledge_files?id=eq.${encoded(fileId)}`, { method: "DELETE" });
}

export async function clearDerivedKnowledge(fileId: string) {
  await Promise.all([
    supabaseRequest(`knowledge_chunks?file_id=eq.${encoded(fileId)}`, { method: "DELETE" }),
    supabaseRequest(`knowledge_file_entities?file_id=eq.${encoded(fileId)}`, { method: "DELETE" }),
    supabaseRequest(`knowledge_file_relations?or=(source_file_id.eq.${encoded(fileId)},target_file_id.eq.${encoded(fileId)})`, { method: "DELETE" })
  ]);
}

export async function insertKnowledgeChunks(input: Array<{
  chunkIndex: number;
  content: string;
  embedding: number[];
  embeddingModel: string;
  embeddingProvider: string;
  fileId: string;
  metadata: Record<string, unknown>;
  pageNumber?: number;
  section?: string;
}>) {
  if (input.length === 0) return [];
  return supabaseRequest<KnowledgeChunkRow[]>(
    "knowledge_chunks?select=id,file_id,chunk_index,content,page_number,section,metadata,embedding_provider,embedding_model,created_at",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(
        input.map((chunk) => ({
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
          embedding_model: chunk.embeddingModel,
          embedding_provider: chunk.embeddingProvider,
          file_id: chunk.fileId,
          metadata: chunk.metadata,
          page_number: chunk.pageNumber ?? null,
          section: chunk.section ?? null
        }))
      )
    }
  );
}

export async function getKnowledgeFileDetail(fileId: string) {
  const [file, chunks, jobs, links, relationRows] = await Promise.all([
    getKnowledgeFile(fileId),
    supabaseRequest<KnowledgeChunkRow[]>(
      `knowledge_chunks?select=id,file_id,chunk_index,content,page_number,section,metadata,embedding_provider,embedding_model,created_at&file_id=eq.${encoded(fileId)}&order=chunk_index.asc&limit=200`
    ),
    supabaseRequest<KnowledgeJobRow[]>(
      `knowledge_processing_jobs?select=id,file_id,stage,status,attempt_count,error,details,started_at,completed_at&file_id=eq.${encoded(fileId)}&order=started_at.desc&limit=100`
    ),
    supabaseRequest<Array<{ entity_id: string; relation_type: string; confidence: number; source_text: string; knowledge_entities: { entity_type: string; canonical_name: string; aliases: string[] } | null }>>(
      `knowledge_file_entities?select=entity_id,relation_type,confidence,source_text,knowledge_entities(entity_type,canonical_name,aliases)&file_id=eq.${encoded(fileId)}&limit=100`
    ),
    supabaseRequest<Array<{ source_file_id: string; target_file_id: string; relation_type: string; confidence: number }>>(
      `knowledge_file_relations?select=source_file_id,target_file_id,relation_type,confidence&or=(source_file_id.eq.${encoded(fileId)},target_file_id.eq.${encoded(fileId)})&limit=100`
    )
  ]);
  const relatedIds = Array.from(new Set(relationRows.map((row) => row.source_file_id === fileId ? row.target_file_id : row.source_file_id)));
  const relatedFiles = relatedIds.length
    ? await supabaseRequest<KnowledgeFileRow[]>(
        `knowledge_files?select=${fileColumns}&id=in.(${relatedIds.map(encoded).join(",")})&limit=100`
      )
    : [];
  return { chunks, entities: links, file, jobs, relatedFiles, relations: relationRows };
}

export async function startKnowledgeJob(fileId: string, stage: string, attemptCount = 1) {
  const rows = await supabaseRequest<KnowledgeJobRow[]>(
    "knowledge_processing_jobs?select=id,file_id,stage,status,attempt_count,error,details,started_at,completed_at",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ attempt_count: attemptCount, file_id: fileId, stage, status: "STARTED" })
    }
  );
  return rows[0];
}

export async function finishKnowledgeJob(jobId: string, details: Record<string, unknown> = {}) {
  await supabaseRequest(`knowledge_processing_jobs?id=eq.${encoded(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify({ completed_at: new Date().toISOString(), details, status: "COMPLETED" })
  });
}

export async function failKnowledgeJob(jobId: string, error: string) {
  await supabaseRequest(`knowledge_processing_jobs?id=eq.${encoded(jobId)}`, {
    method: "PATCH",
    body: JSON.stringify({ completed_at: new Date().toISOString(), error: error.slice(0, 2000), status: "FAILED" })
  });
}

export async function saveKnowledgeEntities(fileId: string, analysis: KnowledgeAnalysis) {
  for (const entity of analysis.entities.slice(0, 50)) {
    const existing = await supabaseRequest<Array<{ id: string }>>(
      `knowledge_entities?select=id&entity_type=eq.${encoded(entity.type)}&canonical_name=eq.${encoded(entity.name)}&limit=1`
    );
    let entityId = existing[0]?.id;
    if (!entityId) {
      const created = await supabaseRequest<Array<{ id: string }>>(
        "knowledge_entities?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            canonical_name: entity.name,
            confidence: entity.confidence,
            entity_type: entity.type
          })
        }
      );
      entityId = created[0]?.id;
    }
    if (!entityId) continue;
    await supabaseRequest("knowledge_file_entities?on_conflict=file_id,entity_id,relation_type", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        confidence: entity.confidence,
        entity_id: entityId,
        file_id: fileId,
        relation_type: "MENTIONS",
        source_text: entity.sourceText
      })
    });
  }
}

export async function linkRelatedKnowledgeFiles(fileId: string, analysis: KnowledgeAnalysis) {
  const terms = [analysis.organization, analysis.event, analysis.location]
    .map((value) => value.trim())
    .filter((value) => value && value !== "UNKNOWN");
  if (terms.length === 0) return;
  const candidates = await supabaseRequest<KnowledgeFileRow[]>(
    `knowledge_files?select=${fileColumns}&id=neq.${encoded(fileId)}&or=(${terms.flatMap((term) => [
      `organization.eq.${encoded(term)}`,
      `event.eq.${encoded(term)}`,
      `location.eq.${encoded(term)}`
    ]).join(",")})&limit=30`
  );
  for (const candidate of candidates) {
    const matches = [
      candidate.organization === analysis.organization,
      candidate.event === analysis.event,
      candidate.location === analysis.location,
      Boolean(analysis.documentDate && candidate.document_date === analysis.documentDate)
    ].filter(Boolean).length;
    const confidence = Math.min(0.95, 0.45 + matches * 0.14);
    for (const [source, target] of [[fileId, candidate.id], [candidate.id, fileId]]) {
      await supabaseRequest("knowledge_file_relations?on_conflict=source_file_id,target_file_id,relation_type", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          confidence,
          metadata: { matchedFields: matches, sourceType: "AI_INFERRED" },
          relation_type: "RELATED_CONTEXT",
          source_file_id: source,
          target_file_id: target
        })
      });
    }
  }
}
