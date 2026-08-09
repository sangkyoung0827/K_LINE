import "server-only";

import { embedKnowledgeQuery } from "@/lib/knowledge/ai";
import { supabaseRequest } from "@/lib/supabaseServer";
import type { KnowledgeSearchResult } from "@/lib/knowledge/types";

type VectorMatchRow = {
  chunk_id: string;
  file_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  similarity: number;
  original_name: string;
  mime_type: string;
  organization: string | null;
  event: string | null;
  location: string | null;
  ai_summary: string | null;
  uploaded_at: string;
};

type KeywordChunkRow = {
  id: string;
  file_id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section: string | null;
  knowledge_files: {
    original_name: string;
    mime_type: string;
    organization: string | null;
    event: string | null;
    location: string | null;
    ai_summary: string | null;
    uploaded_at: string;
  } | null;
};

function queryTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^0-9a-zA-Z가-힣_-]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  ).slice(0, 8);
}

function lexicalScore(content: string, query: string) {
  const normalized = content.toLowerCase();
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  return Math.min(
    1,
    terms.reduce((score, term) => score + (normalized.includes(term) ? 1 / terms.length : 0), 0)
  );
}

function normalizedResult(row: VectorMatchRow, score: number): KnowledgeSearchResult {
  return {
    chunkId: row.chunk_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    event: row.event ?? "",
    fileId: row.file_id,
    fileName: row.original_name,
    location: row.location ?? "",
    mimeType: row.mime_type,
    organization: row.organization ?? "",
    pageNumber: row.page_number,
    score,
    section: row.section ?? "",
    summary: row.ai_summary ?? "",
    uploadedAt: row.uploaded_at
  };
}

async function vectorSearch(query: string, limit: number, organization?: string) {
  const embedded = await embedKnowledgeQuery(query);
  return supabaseRequest<VectorMatchRow[]>("rpc/match_knowledge_chunks", {
    method: "POST",
    body: JSON.stringify({
      match_count: Math.min(Math.max(limit * 4, 20), 60),
      organization_filter: organization || null,
      query_embedding: embedded.vector,
      status_filter: "READY"
    })
  });
}

async function keywordSearch(query: string, organization?: string) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const safeTerms = terms.map((term) => encodeURIComponent(term.replace(/[,*()]/g, ""))).filter(Boolean);
  const filters = [
    "select=id,file_id,chunk_index,content,page_number,section,knowledge_files!inner(original_name,mime_type,organization,event,location,ai_summary,uploaded_at,processing_status)",
    "knowledge_files.processing_status=eq.READY",
    `or=(${safeTerms.map((term) => `content.ilike.*${term}*`).join(",")})`,
    "limit=60"
  ];
  if (organization) filters.push(`knowledge_files.organization=eq.${encodeURIComponent(organization)}`);
  return supabaseRequest<KeywordChunkRow[]>(`knowledge_chunks?${filters.join("&")}`);
}

export async function searchKnowledge(input: {
  limit?: number;
  organization?: string;
  query: string;
}) {
  const query = input.query.trim().slice(0, 1000);
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 20);
  if (!query) return [];

  const [vectorRows, keywordRows] = await Promise.all([
    vectorSearch(query, limit, input.organization).catch((error) => {
      console.error("Knowledge vector search failed", error);
      return [] as VectorMatchRow[];
    }),
    keywordSearch(query, input.organization).catch((error) => {
      console.error("Knowledge keyword search failed", error);
      return [] as KeywordChunkRow[];
    })
  ]);

  const combined = new Map<string, KnowledgeSearchResult>();
  vectorRows.forEach((row) => {
    const lexical = lexicalScore(`${row.content} ${row.original_name} ${row.organization ?? ""} ${row.event ?? ""}`, query);
    combined.set(row.chunk_id, normalizedResult(row, Math.min(1, row.similarity * 0.72 + lexical * 0.28)));
  });
  keywordRows.forEach((row) => {
    const file = row.knowledge_files;
    if (!file) return;
    const lexical = lexicalScore(`${row.content} ${file.original_name} ${file.organization ?? ""} ${file.event ?? ""}`, query);
    const existing = combined.get(row.id);
    const candidate = normalizedResult(
      {
        ai_summary: file.ai_summary,
        chunk_id: row.id,
        chunk_index: row.chunk_index,
        content: row.content,
        event: file.event,
        file_id: row.file_id,
        location: file.location,
        mime_type: file.mime_type,
        organization: file.organization,
        original_name: file.original_name,
        page_number: row.page_number,
        section: row.section,
        similarity: 0,
        uploaded_at: file.uploaded_at
      },
      Math.max(existing?.score ?? 0, lexical * 0.82)
    );
    combined.set(row.id, candidate);
  });

  return Array.from(combined.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatKnowledgeContext(results: KnowledgeSearchResult[]) {
  if (results.length === 0) {
    return "WOOHYUKMON PRIVATE KNOWLEDGE: No matching source was found. Do not invent an answer from the private database.";
  }
  return [
    "WOOHYUKMON PRIVATE KNOWLEDGE SOURCES",
    "Use these sources before general knowledge. If evidence is incomplete, say so. Cite file names in the answer.",
    ...results.map((result, index) =>
      [
        `[Source ${index + 1}] ${result.fileName}`,
        `File ID: ${result.fileId}`,
        result.pageNumber ? `Page: ${result.pageNumber}` : "",
        result.section ? `Section: ${result.section}` : "",
        result.organization ? `Organization: ${result.organization}` : "",
        result.event ? `Event: ${result.event}` : "",
        `Relevance: ${result.score.toFixed(3)}`,
        `Content: ${result.content.slice(0, 2400)}`
      ].filter(Boolean).join("\n")
    )
  ].join("\n\n");
}
