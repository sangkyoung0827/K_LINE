import "server-only";
import { supabaseRequest, getSupabaseConfig } from "@/lib/supabaseServer";
import { inspectResourceFile } from "@/lib/eccResources/storage";
import { ArchiveError, assertArchiveWrite, fileTypes, maxFileBytes, uuid, type ArchiveAccess, type ArchiveClub } from "./model";
import { sha256, verifyOriginalFile } from "./integrity";
import { prepareImport, finalizeImport } from "./service";

const sources = ["ecc_resource_files", "club_board_posts", "hanhwal_board_posts", "kline_forms_live_google_form_workflows", "kline_forms_live_club_board_posts", "kline_forms_live_event_studio_jobs"] as const;
type Source = typeof sources[number];
type LegacyRow = { id: string; title?: string; content?: string; notice?: string; board_id?: string; club_key?: string;
  file_name?: string; mime_type?: string; size_bytes?: number; storage_path?: string;
  author_name?: string; author_email?: string; uploader_name?: string; uploader_email?: string; created_at?: string;
  plan?: { title?: string; noticeKo?: string; noticeEn?: string }; draft?: { title?: string } };
function sourceClub(source: Source, row: LegacyRow): ArchiveClub {
  if (source === "ecc_resource_files") return "ecc";
  if (source === "hanhwal_board_posts") return "hanhwal";
  const club = row.club_key || row.board_id;
  return club === "ecc" || club === "hanhwal" || club === "social_impact_union" ? club : "unclassified";
}
function scopeFilter(access: ArchiveAccess, source: Source) {
  if (source === "ecc_resource_files") { if (!access.clubs.includes("ecc")) throw new ArchiveError("CLUB_ADMIN_REQUIRED", 403); return ""; }
  if (source === "hanhwal_board_posts") { if (!access.clubs.includes("hanhwal")) throw new ArchiveError("CLUB_ADMIN_REQUIRED", 403); return ""; }
  if (access.superAdmin) return "";
  const field = source.includes("board_posts") ? "board_id" : "club_key";
  return `&${field}=in.(${access.clubs.filter(c => c !== "unclassified").join(",")})`;
}
async function legacyRows(access: ArchiveAccess, source: Source, id?: string) {
  if (!access.email || access.readOnly || !access.clubs.length) throw new ArchiveError("CLUB_ADMIN_REQUIRED", 403);
  const filter = scopeFilter(access, source);
  return supabaseRequest<LegacyRow[]>(`${source}?select=*&limit=100${id ? `&id=eq.${uuid(id)}` : ""}${filter}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
}
export async function legacyPreview(access: ArchiveAccess) {
  const result = [];
  for (const source of sources) {
    try {
      const rows = await legacyRows(access, source); const candidates = [];
      for (const row of rows) {
        assertArchiveWrite(access, sourceClub(source, row));
        let fileExists: boolean | undefined;
        if (row.storage_path) {
          try { const info = await inspectResourceFile(row.storage_path); fileExists = info.sizeBytes === row.size_bytes; } catch { fileExists = false; }
        }
        candidates.push({ id: row.id, title: row.title || row.plan?.title || row.draft?.title || source, kind: row.storage_path ? "file" : "text", fileExists });
      }
      result.push({ source, status: "available", candidates });
    } catch (error) { result.push({ source, status: error instanceof ArchiveError && error.status === 403 ? "not_authorized" : "unavailable", candidates: [] }); }
  }
  return { sources: result, limitPerSource: 100, sourceModified: false };
}
export async function copyLegacy(access: ArchiveAccess, value: Record<string, unknown>) {
  if (value.confirmed !== true) throw new ArchiveError("EXPLICIT_APPROVAL_REQUIRED", 403);
  if (!sources.includes(value.source as Source)) throw new ArchiveError("INVALID_LEGACY_SOURCE");
  const source = value.source as Source;
  const rows = await legacyRows(access, source, String(value.id || ""));
  if (!rows[0]) throw new ArchiveError("LEGACY_NOT_FOUND", 404);
  const row = rows[0], club = sourceClub(source, row); assertArchiveWrite(access, club);
  // Store source attribution separately from imported originals. Never synthesize a combined original.
  const sourceIdentifier = JSON.stringify({ table: source, id: row.id, author: row.author_name || row.uploader_name || row.author_email || row.uploader_email || null, createdAt: row.created_at || null });
  const texts = row.content !== undefined ? [row.content] : row.notice !== undefined ? [row.notice] : row.plan ? [row.plan.noticeKo, row.plan.noticeEn].filter((s): s is string => typeof s === "string" && s.length > 0) : [];
  let bytes: Uint8Array | null = null;
  const files = [];
  if (row.storage_path) {
    if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.[a-z0-9]+$/i.test(row.storage_path) || !row.file_name || !row.size_bytes || row.size_bytes > maxFileBytes) throw new ArchiveError("LEGACY_FILE_MANUAL_IMPORT_REQUIRED", 422);
    const mime = fileTypes[row.file_name.split(".").at(-1)?.toLowerCase() || ""];
    if (!mime || mime !== row.mime_type) throw new ArchiveError("UNSUPPORTED_FILE_TYPE", 422);
    const { url, serviceRoleKey } = getSupabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/ecc-resource-library/${row.storage_path}`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok || Number(response.headers.get("content-length")) > maxFileBytes) throw new ArchiveError("LEGACY_FILE_UNAVAILABLE", 409);
    const reader = response.body?.getReader(); if (!reader) throw new ArchiveError("LEGACY_FILE_UNAVAILABLE", 409);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const r = await reader.read(); if (r.done) break; length += r.value.length; if (length > maxFileBytes) { await reader.cancel(); throw new ArchiveError("FILE_TOO_LARGE", 413); } chunks.push(r.value); }
    bytes = Buffer.concat(chunks);
    const descriptor = { name: row.file_name, size: row.size_bytes, mimeType: mime, sha256: sha256(bytes) };
    await verifyOriginalFile(descriptor, bytes); files.push(descriptor);
  }
  const prepared = await prepareImport(access, { clubKey: club, idempotencyKey: `legacy-${sha256(JSON.stringify([source, row.id, texts, files]))}`, texts, files, sourceKind: "legacy", sourceIdentifier, upstreamFormatting: "unknown", aiConsent: false });
  if (bytes && prepared.uploads[0]) {
    const r = await fetch(prepared.uploads[0].signedUrl, { method: "PUT", headers: { "Content-Type": files[0].mimeType, "x-upsert": "false" }, body: Buffer.from(bytes), redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!r.ok && r.status !== 409) throw new ArchiveError("UPLOAD_NOT_RECEIVED", 409);
  }
  return finalizeImport(access, prepared.batch_id);
}
