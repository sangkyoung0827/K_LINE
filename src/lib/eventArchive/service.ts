import "server-only";
import { randomUUID } from "node:crypto";
import { ArchiveError, assertArchiveWrite, canReadArchive, parseManifest, parseLabels, uuid,
  originalText, type ArchiveAccess, type ArchiveAsset, type ArchiveItem, type ImportJob } from "./model";
import { sha256, verifyOriginalFile } from "./integrity";
import { archiveRequest, originalBytes, originalUploadUrl, originalReadUrl, removeTemporaryOriginal } from "./store";

const post = (body: object) => ({ method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
export function uploadPath(job: ImportJob, index: number) {
  const f = job.manifest.files[index];
  return `${job.club_key}/${job.id}/${index}-${f.sha256}.${f.name.split(".").at(-1)!.toLowerCase()}`;
}
async function getJob(access: ArchiveAccess, id: string) {
  const rows = await archiveRequest<ImportJob[]>(`event_archive_import_jobs?id=eq.${uuid(id)}&actor_email=eq.${encodeURIComponent(access.email)}&limit=1`);
  if (!rows[0]) throw new ArchiveError("IMPORT_NOT_FOUND", 404);
  assertArchiveWrite(access, rows[0].club_key);
  return rows[0];
}
export async function loadArchiveItem(access: ArchiveAccess, id: string, write = false): Promise<ArchiveItem> {
  const rows = await archiveRequest<ArchiveItem[]>(`event_archive_items?id=eq.${uuid(id)}&limit=1`);
  if (!rows[0] || !canReadArchive(access, rows[0])) throw new ArchiveError("ARCHIVE_NOT_FOUND", 404);
  const item = rows[0]; if (write) assertArchiveWrite(access, item.club_key);
  item.assets = await archiveRequest<ArchiveAsset[]>(`event_archive_assets?archive_item_id=eq.${item.id}&order=uploaded_at.asc`);
  if (access.clubs.includes(item.club_key)) {
    const labels = await archiveRequest<{ labels: import("./model").ArchiveLabels }[]>(`event_archive_labels?archive_item_id=eq.${item.id}&status=eq.review_required&order=created_at.desc&limit=1`);
    item.derivedLabels = labels[0]?.labels;
    item.versions = await archiveRequest<ArchiveItem["versions"]>(`event_archive_versions?or=(original_item_id.eq.${item.id},version_item_id.eq.${item.id})&order=created_at.desc`);
  } else {
    item.created_by = ""; item.reviewed_by = null; item.source_identifier = null; item.batch_id = "";
  }
  return item;
}
export async function prepareImport(access: ArchiveAccess, value: unknown) {
  const manifest = parseManifest(value); assertArchiveWrite(access, manifest.clubKey);
  const job = await archiveRequest<ImportJob>("rpc/event_archive_reserve", post({ p_actor: access.email, p_manifest: manifest, p_hash: sha256(JSON.stringify(manifest)) }));
  return { status: job.status, batch_id: job.id, uploads: await uploads(job), results: job.results };
}
async function uploads(job: ImportJob) {
  const result: { index: number; signedUrl: string; path: string }[] = [];
  for (let index = 0; index < job.manifest.files.length; index++) {
    if (job.results.some(r => r.index === job.manifest.texts.length + index && r.archiveId)) continue;
    const path = uploadPath(job, index);
    result.push({ index, path, signedUrl: await originalUploadUrl(path) });
  }
  return result;
}
async function confirmItem(access: ArchiveAccess, id: string) {
  const item = await loadArchiveItem(access, id);
  if (item.original_text !== null && sha256(item.original_text) !== item.original_text_sha256) throw new ArchiveError("ORIGINAL_HASH_MISMATCH", 422);
  for (const asset of item.assets || []) {
    const bytes = await originalBytes(asset.original_storage_path, asset.file_size);
    await verifyOriginalFile({ name: asset.original_filename, size: asset.file_size, mimeType: asset.mime_type, sha256: asset.sha256 }, bytes);
  }
  if (item.original_text === null && !item.assets?.length) throw new ArchiveError("ORIGINAL_NOT_CONFIRMED", 409);
  return item;
}
export async function finalizeImport(access: ArchiveAccess, id: string) {
  const initial = await getJob(access, id);
  const token = randomUUID();
  const job = await archiveRequest<ImportJob>("rpc/event_archive_claim", post({ p_id: initial.id, p_actor: access.email, p_token: token }));
  const startedAt = Date.now(), m = job.manifest; const results: ImportJob["results"] = [];
  const receipts: object[] = [];
  try {
    for (let index = 0; index < m.texts.length + m.files.length; index++) {
      try {
        const completed = job.results.find(r => r.index === index && r.archiveId);
        if (completed?.archiveId) {
          const item = await loadArchiveItem(access, completed.archiveId);
          results.push(completed);
          receipts.push({ archive_id: item.id, original_preserved: true, verification: "previously_verified",
            classification_status: item.classification_status, original_text_sha256: item.original_text_sha256,
            asset_hashes: item.assets?.map(a => a.sha256), archive_url: `/event-studio?archive=${item.id}`, duplicate: item.batch_id !== job.id });
          continue;
        }
        // Return a resumable partial receipt before the hosting request deadline.
        if (Date.now() - startedAt > 90000) {
          results.push({ index, error: "IMPORT_CONTINUE_REQUIRED" });
          continue;
        }
        let text = index < m.texts.length ? m.texts[index] : null;
        const fileIndex = index - m.texts.length, file = index >= m.texts.length ? m.files[fileIndex] : null;
        let filePath: string | null = null;
        const contentKey = file ? sha256(JSON.stringify(["file", file.sha256, file.name])) : sha256(`text\0${text}`);
        const prior = await archiveRequest<ArchiveItem[]>(`event_archive_items?club_key=eq.${m.clubKey}&content_key=eq.${contentKey}&limit=1`);
        if (file) {
          if (prior[0]) {
            const confirmed = await confirmItem(access, prior[0].id);
            const asset = confirmed.assets?.find(a => a.sha256 === file.sha256 && a.original_filename === file.name && a.file_size === file.size && a.mime_type === file.mimeType);
            if (!asset) throw new ArchiveError("ORIGINAL_HASH_MISMATCH", 422);
            filePath = asset.original_storage_path;
            text = confirmed.original_text;
          } else {
            filePath = uploadPath(job, fileIndex);
            const bytes = await originalBytes(filePath, file.size);
            await verifyOriginalFile(file, bytes);
            if (file.mimeType.startsWith("text/")) {
              const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
              // Large text documents retain their complete binary original;
              // never truncate a searchable field and present it as the original.
              if (decoded.length <= 200000) text = originalText(decoded);
            }
          }
        }
        const saved = await archiveRequest<ArchiveItem>("rpc/event_archive_commit", post({ p_item: {
          club_key: m.clubKey, batch_id: job.id, content_key: contentKey, original_text: text,
          original_text_sha256: text === null ? null : sha256(text), source_kind: m.sourceKind,
          source_identifier: m.sourceIdentifier, upstream_formatting: m.upstreamFormatting,
          ai_consent: m.aiConsent, created_by: access.email,
        }, p_asset: file ? { original_filename: file.name, original_storage_path: filePath, sha256: file.sha256, file_size: file.size, mime_type: file.mimeType } : null, p_token: token }));
        const confirmed = await confirmItem(access, saved.id);
        if (confirmed.original_text !== text) throw new ArchiveError("ORIGINAL_HASH_MISMATCH", 422);
        // Preserve every reuse/import relation and input order, without overwriting the first source.
        await archiveRequest("event_archive_links?on_conflict=archive_item_id,target_kind,target_id,input_index", {
          ...post({ archive_item_id: saved.id, target_kind: "import", target_id: job.id, input_index: index, created_by: access.email }),
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        });
        const temporary = file ? uploadPath(job, fileIndex) : null;
        if (temporary && !confirmed.assets?.some(a => a.original_storage_path === temporary)) await removeTemporaryOriginal(temporary);
        results.push({ index, archiveId: saved.id });
        receipts.push({ archive_id: saved.id, original_preserved: true, classification_status: confirmed.classification_status,
          original_text_sha256: confirmed.original_text_sha256, asset_hashes: confirmed.assets?.map(a => a.sha256),
          archive_url: `/event-studio?archive=${saved.id}`, duplicate: saved.batch_id !== job.id });
      } catch (error) {
        results.push({ index, error: error instanceof ArchiveError ? error.code : "IMPORT_ITEM_FAILED" });
      }
      // Persist after EACH item. Crashes are recovered by hash/idempotent insert; no success-only in-memory ledger.
      const renewed = await archiveRequest<ImportJob[]>(`event_archive_import_jobs?id=eq.${job.id}&lease_token=eq.${token}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ results, updated_at: new Date().toISOString(), lease_until: new Date(Date.now() + 180000).toISOString() }),
      });
      if (!renewed.length) throw new ArchiveError("IMPORT_BUSY", 409);
    }
    const status = results.every(r => r.archiveId) ? "saved" : "partial";
    await archiveRequest(`event_archive_import_jobs?id=eq.${job.id}&lease_token=eq.${token}`, { method: "PATCH", body: JSON.stringify({ results, status, lease_until: null, lease_token: null, updated_at: new Date().toISOString() }) });
    return { status, batch_id: job.id, results, archive_items: receipts };
  } catch (error) {
    await archiveRequest(`event_archive_import_jobs?id=eq.${job.id}&lease_token=eq.${token}`, { method: "PATCH", body: JSON.stringify({ results, status: "partial", lease_until: null, lease_token: null }) }).catch(() => undefined);
    throw error;
  }
}
export async function importStatus(access: ArchiveAccess, id: string) {
  const job = await getJob(access, id);
  return { batch_id: job.id, status: job.status, results: job.results, files: job.manifest.files,
    uploads: job.status === "saved" ? [] : await uploads(job) };
}
export async function pendingImports(access: ArchiveAccess) {
  if (!access.email || access.readOnly || !access.clubs.length) throw new ArchiveError("ARCHIVE_WRITE_DENIED", 403);
  const jobs = await archiveRequest<ImportJob[]>(`event_archive_import_jobs?actor_email=eq.${encodeURIComponent(access.email)}&club_key=in.(${access.clubs.join(",")})&status=in.(pending,partial,running)&order=created_at.desc&limit=10`);
  return { jobs: jobs.map(job => ({ batchId: job.id, clubKey: job.club_key, status: job.status,
    createdAt: job.created_at, total: job.manifest.texts.length + job.manifest.files.length,
    saved: job.results.filter(result => result.archiveId).length })) };
}
export async function listArchive(access: ArchiveAccess, query: URLSearchParams) {
  if (!access.email) throw new ArchiveError("LOGIN_REQUIRED", 401);
  const scope = access.clubs.length ? `or=(club_key.in.(${access.clubs.join(",")}),and(visibility.eq.public,review_status.eq.approved))` : "visibility=eq.public&review_status=eq.approved";
  const filters = new URLSearchParams();
  const club = query.get("club"); if (club) { const { archiveClub } = await import("./model"); filters.set("club_key", `eq.${archiveClub(club)}`); }
  const type = query.get("type"); if (type) { const { archiveTypes } = await import("./model"); if (!archiveTypes.includes(type as never)) throw new ArchiveError("INVALID_FILTER"); filters.set("item_type", `eq.${type}`); }
  for (const [name, operator] of [["from", "gte"], ["to", "lte"]] as const) {
    const date = query.get(name); if (date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw new ArchiveError("INVALID_FILTER"); filters.append("event_date", `${operator}.${date}`); }
  }
  const tag = query.get("tag"); if (tag) { if (tag.length > 80) throw new ArchiveError("INVALID_FILTER"); filters.set("suggested_tags", `cs.${JSON.stringify([tag])}`); }
  const q = query.get("q") || ""; if (q.length > 150) throw new ArchiveError("INVALID_FILTER");
  const offset = Number(query.get("offset") || 0); if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new ArchiveError("INVALID_FILTER");
  // Search is a separate AND group from authorization. Escape PostgREST quoted literals and wildcard chars.
  if (q) {
    const pattern = `"*${q.replace(/[\\"%_*]/g, c => `\\${c}`)}*"`;
    filters.set("and", `(or(title_suggestion.ilike.${pattern},original_text.ilike.${pattern},summary.ilike.${pattern}))`);
  }
  const items = await archiveRequest<ArchiveItem[]>(`event_archive_items?${scope}&${filters}&order=created_at.desc&limit=40&offset=${offset}`);
  const output = [];
  for (const item of items) {
    const assets = await archiveRequest<ArchiveAsset[]>(`event_archive_assets?archive_item_id=eq.${item.id}`);
    output.push({ ...item, ...(access.clubs.includes(item.club_key) ? {} : {
      created_by: "", reviewed_by: null, source_identifier: null, batch_id: "",
    }), assets });
  }
  return { items: output, hasMore: items.length === 40, access };
}
export async function archiveDownload(access: ArchiveAccess, id: string, assetId: string) {
  const item = await confirmItem(access, id);
  const asset = item.assets?.find(a => a.id === uuid(assetId));
  if (!asset) throw new ArchiveError("ARCHIVE_NOT_FOUND", 404);
  return { url: await originalReadUrl(asset.original_storage_path, asset.original_filename), expiresIn: 60 };
}
export async function saveLabels(access: ArchiveAccess, id: string, raw: unknown, origin: "human" | "ai" = "human", model: string | null = null) {
  const item = await loadArchiveItem(access, id, true);
  const labels = parseLabels(raw, item.original_text || "", origin === "human");
  const row = await archiveRequest(`event_archive_labels`, post({ archive_item_id: item.id, labels, origin, model, status: "review_required", created_by: access.email }));
  await archiveRequest(`event_archive_items?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify({
    title_suggestion: labels.title, item_type: labels.itemType, event_type: labels.eventType, event_date: labels.eventDate,
    language: labels.language, academic_term: labels.academicTerm, suggested_tags: labels.tags, summary: labels.summary, confidence: labels.confidence,
    classification_status: "review_required", visibility: "private", review_status: "pending", reviewed_by: null, updated_at: new Date().toISOString(),
  }) });
  return { labels: row, item: await loadArchiveItem(access, id) };
}
export async function reviewArchive(access: ArchiveAccess, id: string, body: Record<string, unknown>) {
  const item = await loadArchiveItem(access, id, true);
  if (body.confirmed !== true || !body.checklist || typeof body.checklist !== "object") throw new ArchiveError("EXPLICIT_REVIEW_REQUIRED", 403);
  const check = body.checklist as Record<string, unknown>;
  if (check.privacy !== true || check.copyright !== true || check.source !== true) throw new ArchiveError("REVIEW_CHECKLIST_REQUIRED", 403);
  if (item.club_key === "unclassified" && body.visibility === "public") throw new ArchiveError("UNKNOWN_SOURCE_CANNOT_PUBLISH", 409);
  const visibility = body.visibility === "public" ? "public" : "private";
  await archiveRequest(`event_archive_items?id=eq.${item.id}`, { method: "PATCH", body: JSON.stringify({ visibility, review_status: "approved", reviewed_by: access.email,
    review_checklist: { privacy: true, copyright: true, source: true }, ai_search_allowed: body.aiSearchAllowed === true,
    ai_consent: body.aiConsent === true, updated_at: new Date().toISOString() }) });
  return { item: await loadArchiveItem(access, id) };
}
export async function newArchiveVersion(access: ArchiveAccess, id: string, text: unknown, key: unknown) {
  const item = await loadArchiveItem(access, id, true);
  const prepared = await prepareImport(access, { clubKey: item.club_key, idempotencyKey: key, texts: [text], files: [], sourceKind: "paste", sourceIdentifier: `version:${id}`, aiConsent: false });
  const result = await finalizeImport(access, prepared.batch_id);
  const next = result.results[0]?.archiveId;
  if (!next || result.status !== "saved") throw new ArchiveError("VERSION_NOT_SAVED", 409);
  if (next === id) throw new ArchiveError("VERSION_IDENTICAL_TO_ORIGINAL", 409);
  await archiveRequest("event_archive_versions?on_conflict=original_item_id,version_item_id", { ...post({ original_item_id: id, version_item_id: next, created_by: access.email }), headers: { Prefer: "resolution=ignore-duplicates" } });
  return result;
}
export async function historicalReferences(access: ArchiveAccess, ids: unknown, targetClub: string) {
  if (!Array.isArray(ids) || ids.length > 5) throw new ArchiveError("INVALID_REFERENCES");
  const refs = [];
  for (const id of [...new Set(ids)]) {
    const item = await loadArchiveItem(access, uuid(id));
    if (item.club_key !== targetClub || item.review_status !== "approved" || !item.ai_consent || !item.ai_search_allowed) throw new ArchiveError("REFERENCE_NOT_APPROVED_FOR_AI", 403);
    const text = (item.original_text || item.summary || "").slice(0, 6000)
      .replace(/https?:\/\/\S+/gi, "[historical link removed]")
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email removed]").replace(/\b\d{10,13}\b/g, "[identifier removed]");
    refs.push({ archiveId: item.id, historicalOnly: true, title: item.title_suggestion, text });
  }
  return refs;
}
export async function linkArchiveReferences(access: ArchiveAccess, ids: string[], jobId: string) {
  for (const id of ids) {
    await loadArchiveItem(access, id);
    await archiveRequest("event_archive_links?on_conflict=archive_item_id,target_kind,target_id,input_index", { ...post({ archive_item_id: id, target_kind: "studio_job", target_id: uuid(jobId), input_index: 0, created_by: access.email }), headers: { Prefer: "resolution=ignore-duplicates" } });
  }
}
export async function cleanImportOrphans(access: ArchiveAccess, id: string) {
  const job = await getJob(access, id);
  if (job.lease_until && Date.parse(job.lease_until) > Date.now()) throw new ArchiveError("IMPORT_BUSY", 409);
  const token = randomUUID();
  await archiveRequest("rpc/event_archive_claim", post({ p_id: job.id, p_actor: access.email, p_token: token }));
  const paths = [];
  try {
    for (let i = 0; i < job.manifest.files.length; i++) {
      const renewed = await archiveRequest<ImportJob[]>(`event_archive_import_jobs?id=eq.${job.id}&lease_token=eq.${token}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ lease_until: new Date(Date.now() + 180000).toISOString() }),
      });
      if (!renewed.length) throw new ArchiveError("IMPORT_BUSY", 409);
      const path = uploadPath(job, i);
      const references = await archiveRequest<ArchiveAsset[]>(`event_archive_assets?original_storage_path=eq.${encodeURIComponent(path)}&limit=1`);
      if (!references.length) { await removeTemporaryOriginal(path); paths.push(path); }
    }
    return { removedTemporaryObjects: paths.length };
  } finally {
    await archiveRequest(`event_archive_import_jobs?id=eq.${job.id}&lease_token=eq.${token}`, {
      method: "PATCH", body: JSON.stringify({ status: job.status === "running" ? "partial" : job.status, lease_until: null, lease_token: null }),
    });
  }
}
