export const knowledgeStatuses = [
  "UPLOADED",
  "QUEUED",
  "EXTRACTING",
  "ANALYZING",
  "CHUNKING",
  "EMBEDDING",
  "INDEXING",
  "READY",
  "UNSUPPORTED",
  "FAILED"
] as const;

export type KnowledgeStatus = (typeof knowledgeStatuses)[number];

export type KnowledgeFileRow = {
  id: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  extension: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string;
  uploaded_at: string;
  processing_status: KnowledgeStatus;
  processing_error: string | null;
  parser_type: string | null;
  extracted_text: string | null;
  ai_summary: string | null;
  ai_description: string | null;
  document_type: string | null;
  organization: string | null;
  event: string | null;
  location: string | null;
  document_date: string | null;
  confidence: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ParsedSection = {
  content: string;
  pageNumber?: number;
  title?: string;
};

export type ParsedDocument = {
  metadata: Record<string, unknown>;
  parserType: string;
  sections: ParsedSection[];
  text: string;
  title: string;
};

export type KnowledgeAnalysis = {
  confidence: number;
  description: string;
  documentDate: string | null;
  documentType: string;
  entities: Array<{
    confidence: number;
    name: string;
    sourceText: string;
    type: "PERSON" | "ORGANIZATION" | "EVENT" | "LOCATION" | "DATE" | "PROJECT" | "ROLE" | "TOPIC";
  }>;
  event: string;
  location: string;
  organization: string;
  summary: string;
};

export type KnowledgeSearchResult = {
  chunkId: string;
  chunkIndex: number;
  content: string;
  event: string;
  fileId: string;
  fileName: string;
  location: string;
  mimeType: string;
  organization: string;
  pageNumber: number | null;
  score: number;
  section: string;
  summary: string;
  uploadedAt: string;
};
