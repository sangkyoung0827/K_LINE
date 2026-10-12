export const archiveClubs = ["ecc", "hanhwal", "social_impact_union", "unclassified"] as const;
export type ArchiveClub = typeof archiveClubs[number];
export const archiveTypes = ["notice", "poster", "plan", "application", "other"] as const;
export const fileTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const maxFileBytes = 25 * 1024 * 1024;
export type ArchiveAccess = { email: string; clubs: ArchiveClub[]; superAdmin: boolean; readOnly: boolean };
export type ArchiveLabels = {
  organizerName?: string | null; eventName?: string | null;
  suggestedClub: ArchiveClub | "other"; itemType: typeof archiveTypes[number]; title: string | null;
  eventType: string | null; eventDate: string | null; language: string | null;
  academicTerm: string | null; tags: string[]; summary: string | null; confidence: number;
};
export type ArchiveFile = { name: string; mimeType: string; size: number; sha256: string };
export type ArchiveCollection = { id: string; title: string; eventDate: string | null; organizerNames: string[] };
export type IngestManifest = {
  clubKey: ArchiveClub; idempotencyKey: string; texts: string[]; files: ArchiveFile[];
  sourceKind: "paste" | "upload" | "connector" | "legacy" | "local_export";
  sourceIdentifier: string | null; upstreamFormatting: "unknown" | "received_verbatim";
  aiConsent: boolean;
  collection?: ArchiveCollection;
};
export type ArchiveItem = {
  id: string; club_key: ArchiveClub; batch_id: string; content_key: string;
  original_text: string | null; original_text_sha256: string | null;
  source_kind: IngestManifest["sourceKind"]; source_identifier: string | null; upstream_formatting: string;
  title_suggestion: string | null; item_type: typeof archiveTypes[number]; language: string | null;
  event_type: string | null; event_date: string | null; academic_term: string | null;
  suggested_tags: string[]; confidence: number | null; summary: string | null;
  visibility: "private" | "public"; review_status: "pending" | "approved";
  classification_status: "pending" | "completed" | "failed" | "review_required";
  ai_consent: boolean; ai_search_allowed: boolean; reviewed_by: string | null;
  created_by: string; created_at: string; updated_at: string;
  assets?: ArchiveAsset[];
  collection?: ArchiveCollection;
  derivedLabels?: ArchiveLabels;
  versions?: { original_item_id: string; version_item_id: string; created_at: string }[];
};
export type ArchiveAsset = {
  id: string; archive_item_id: string; original_filename: string; original_storage_path: string;
  sha256: string; file_size: number; mime_type: string; preview_storage_path: string | null;
};
export type ImportJob = {
  id: string; actor_email: string; club_key: ArchiveClub; idempotency_key: string; payload_sha256: string;
  manifest: IngestManifest; results: { index: number; archiveId?: string; error?: string }[];
  status: "pending" | "running" | "partial" | "saved"; lease_until: string | null; lease_token: string | null; created_at: string;
};
export class ArchiveError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ArchiveError("INVALID_ARCHIVE_ID");
  return value;
}
export function archiveClub(value: unknown): ArchiveClub {
  if (!archiveClubs.includes(value as ArchiveClub)) throw new ArchiveError("INVALID_ARCHIVE_CLUB");
  return value as ArchiveClub;
}
export function assertArchiveWrite(access: ArchiveAccess, club: ArchiveClub) {
  if (!access.email) throw new ArchiveError("LOGIN_REQUIRED", 401);
  if (access.readOnly) throw new ArchiveError("READ_ONLY_ACCOUNT", 403);
  if (!access.clubs.includes(club) || club === "unclassified" && !access.superAdmin) throw new ArchiveError("CLUB_ADMIN_REQUIRED", 403);
}
export function canReadArchive(access: ArchiveAccess, item: Pick<ArchiveItem, "club_key" | "visibility" | "review_status">) {
  return Boolean(access.email) && (access.clubs.includes(item.club_key) || item.visibility === "public" && item.review_status === "approved");
}
export function originalText(value: unknown): string {
  if (typeof value !== "string" || !value.length || value.length > 200000) throw new ArchiveError("INVALID_ORIGINAL_TEXT");
  // PostgreSQL text cannot represent NUL or unpaired UTF-16 surrogates. Reject, never repair.
  if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new ArchiveError("UNSUPPORTED_TEXT_ENCODING");
  return value;
}
export function parseManifest(raw: unknown): IngestManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ArchiveError("INVALID_MANIFEST");
  const r = raw as Record<string, unknown>;
  if (typeof r.idempotencyKey !== "string" || !/^[\w-]{16,100}$/.test(r.idempotencyKey)) throw new ArchiveError("IDEMPOTENCY_KEY_REQUIRED");
  if (!Array.isArray(r.texts) || !Array.isArray(r.files) || !r.texts.length && !r.files.length || r.texts.length + r.files.length > 20) throw new ArchiveError("INVALID_BATCH");
  const texts = r.texts.map(originalText);
  if (texts.reduce((n, t) => n + t.length, 0) > 500000) throw new ArchiveError("BATCH_TOO_LARGE", 413);
  let total = 0;
  const files = r.files.map((value): ArchiveFile => {
    if (!value || typeof value !== "object") throw new ArchiveError("INVALID_FILE");
    const f = value as Record<string, unknown>;
    if (typeof f.name !== "string" || !f.name.length || f.name.length > 255 || /[\u0000-\u001f]/.test(f.name)) throw new ArchiveError("INVALID_FILENAME");
    const ext = f.name.split(".").at(-1)?.toLowerCase() || "";
    if (!fileTypes[ext] || f.mimeType !== fileTypes[ext]) throw new ArchiveError("UNSUPPORTED_FILE_TYPE");
    if (!Number.isInteger(f.size) || Number(f.size) < 1 || Number(f.size) > maxFileBytes) throw new ArchiveError("FILE_TOO_LARGE", 413);
    if (typeof f.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new ArchiveError("INVALID_FILE_HASH");
    total += Number(f.size);
    return { name: f.name, mimeType: String(f.mimeType), size: Number(f.size), sha256: f.sha256 };
  });
  if (total > 100 * 1024 * 1024) throw new ArchiveError("BATCH_TOO_LARGE", 413);
  const sourceKind = r.sourceKind ?? "paste";
  if (!["paste", "upload", "connector", "legacy", "local_export"].includes(String(sourceKind))) throw new ArchiveError("INVALID_SOURCE");
  if (r.sourceIdentifier != null && (typeof r.sourceIdentifier !== "string" || r.sourceIdentifier.length > 500)) throw new ArchiveError("INVALID_SOURCE");
  let collection: ArchiveCollection | undefined;
  if (r.collection != null) {
    const c = r.collection as ArchiveCollection;
    if (!c || typeof c !== "object" || typeof c.id !== "string" || !/^[\w-]{1,100}$/.test(c.id) ||
      typeof c.title !== "string" || !c.title.trim() || c.title.length > 200 ||
      !Array.isArray(c.organizerNames) || c.organizerNames.length > 10 || c.organizerNames.some(n => typeof n !== "string" || n.length > 200) ||
      c.eventDate !== null && (typeof c.eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.eventDate) ||
        !Number.isFinite(Date.parse(c.eventDate)) || new Date(c.eventDate).toISOString().slice(0, 10) !== c.eventDate)) throw new ArchiveError("INVALID_COLLECTION");
    collection = { id: c.id, title: c.title, eventDate: c.eventDate, organizerNames: c.organizerNames };
  }
  return { clubKey: archiveClub(r.clubKey), idempotencyKey: r.idempotencyKey, texts, files, ...(collection ? { collection } : {}),
    sourceKind: sourceKind as IngestManifest["sourceKind"], sourceIdentifier: r.sourceIdentifier as string | null ?? null,
    upstreamFormatting: r.upstreamFormatting === "received_verbatim" ? "received_verbatim" : "unknown", aiConsent: r.aiConsent === true };
}
export function parseLabels(value: unknown, evidence = "", humanReviewedDate = false): ArchiveLabels {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ArchiveError("INVALID_LABELS");
  const r = value as Record<string, unknown>;
  const nullable = (key: string, max = 500) => {
    if (r[key] === null) return null;
    if (typeof r[key] !== "string" || (r[key] as string).length > max) throw new ArchiveError("INVALID_LABELS");
    return r[key] as string;
  };
  if (![...archiveClubs, "other"].includes(r.suggestedClub as ArchiveClub) || !archiveTypes.includes(r.itemType as typeof archiveTypes[number]) ||
    typeof r.confidence !== "number" || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1 ||
    !Array.isArray(r.tags) || r.tags.length > 20 || r.tags.some(t => typeof t !== "string" || t.length > 80)) throw new ArchiveError("INVALID_LABELS");
  let date = nullable("eventDate", 10);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new ArchiveError("INVALID_LABEL_DATE");
  // Only verbatim ISO dates are auto-confirmable. Other date formats and vision suggestions need review.
  if (date && !humanReviewedDate && !evidence.includes(date)) date = null;
  return { suggestedClub: r.suggestedClub as ArchiveLabels["suggestedClub"], itemType: r.itemType as ArchiveLabels["itemType"],
    organizerName: r.organizerName == null ? null : nullable("organizerName", 200), eventName: r.eventName == null ? null : nullable("eventName", 200),
    title: nullable("title", 200), eventType: nullable("eventType", 100), eventDate: date,
    language: nullable("language", 50), academicTerm: nullable("academicTerm", 50), tags: r.tags as string[],
    summary: nullable("summary", 1500), confidence: r.confidence };
}
const nullableString = { type: ["string", "null"] };
export const archiveLabelSchema = {
  type: "object", additionalProperties: false,
  properties: { suggestedClub: { type: "string", enum: [...archiveClubs, "other"] }, itemType: { type: "string", enum: [...archiveTypes] },
    title: nullableString, organizerName: nullableString, eventName: nullableString, eventType: nullableString, eventDate: nullableString, language: nullableString, academicTerm: nullableString,
    tags: { type: "array", items: { type: "string" } }, summary: nullableString, confidence: { type: "number" } },
  required: ["suggestedClub", "itemType", "title", "organizerName", "eventName", "eventType", "eventDate", "language", "academicTerm", "tags", "summary", "confidence"],
};
