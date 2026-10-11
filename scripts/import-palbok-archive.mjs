import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import { liveArchiveRuntime } from "./event-archive-live-runtime.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function readPalbokBundle(path) {
  const zipBytes = await readFile(path), zip = await JSZip.loadAsync(zipBytes);
  const manifest = JSON.parse(await zip.file("event_archive_manifest.json").async("string"));
  const labels = parse(await zip.file("labels.csv").async("string"), { columns: true, bom: true });
  if (manifest.bundle_id !== "wellcome-palbok-festival-20261017-chat-20261012" || manifest.file_count !== 14 || manifest.notice_count !== 2 || manifest.items.length !== 16 || labels.length !== 16) throw Error("Unexpected bundle or counts");
  const entries = [];
  for (const item of manifest.items) {
    if (!/^(original_posters|original_notices)\//.test(item.relative_path) || item.relative_path.includes("..") || basename(item.relative_path) !== item.original_filename) throw Error("Unsafe original path");
    const entry = zip.file(item.relative_path); if (!entry) throw Error(`Missing original ${item.asset_id}`);
    const bytes = await entry.async("nodebuffer");
    const csv = labels.find(label => label.asset_id === item.asset_id);
    if (hash(bytes) !== item.sha256 || bytes.length !== item.size_bytes || !csv || csv.sha256 !== item.sha256 || csv.relative_path !== item.relative_path || csv.original_filename !== item.original_filename) throw Error(`Original/metadata mismatch ${item.asset_id}`);
    const mimeType = item.original_filename.endsWith(".png") ? "image/png" : item.original_filename.endsWith(".txt") ? "text/plain" : "image/jpeg";
    if (mimeType === "text/plain" && item.original_text !== new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)) throw Error(`Notice text mismatch ${item.asset_id}`);
    entries.push({ source: item, bytes, descriptor: { name: item.original_filename, size: bytes.length, sha256: item.sha256, mimeType } });
  }
  if (new Set(entries.map(e => e.source.asset_id)).size !== 16 || entries.filter(e => e.descriptor.mimeType.startsWith("image/")).length !== 14) throw Error("Duplicate source IDs or image count");
  return { manifest, entries, zipSha256: hash(zipBytes) };
}

if (process.argv[1]?.endsWith("import-palbok-archive.mjs")) {
  if (!process.argv.includes("--execute-approved-import")) throw Error("Explicit approved-import flag required");
  const path = process.env.PALBOK_IMPORT_ZIP; if (!path) throw Error("Original ZIP path required");
  const { manifest, entries, zipSha256 } = await readPalbokBundle(path);
  console.log(JSON.stringify({ phase: "originals_verified", images: 14, notices: 2, zipSha256 }));
  const { api, access } = await liveArchiveRuntime();
  const input = { clubKey: "unclassified", idempotencyKey: manifest.bundle_id, texts: [], files: entries.map(e => e.descriptor),
    sourceKind: "upload", sourceIdentifier: manifest.bundle_id, upstreamFormatting: "received_verbatim", aiConsent: true,
    collection: { id: manifest.bundle_id, title: manifest.title, eventDate: manifest.event_date, organizerNames: manifest.organizer_tags } };
  const prepared = await api.prepareImport(access, input);
  for (const upload of prepared.uploads) {
    const original = entries[upload.index];
    const response = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": original.descriptor.mimeType, "x-upsert": "false" }, body: original.bytes });
    if (!response.ok && response.status !== 409 && !(response.status === 400 && /already exists|Duplicate/i.test(await response.text()))) throw Error(`Upload failed ${original.source.asset_id}: ${response.status}`);
    console.log(JSON.stringify({ phase: "uploaded", sourceId: original.source.asset_id }));
  }
  let receipt;
  for (let attempt = 0; attempt < 4; attempt++) {
    receipt = await api.finalizeImport(access, prepared.batch_id);
    console.log(JSON.stringify({ phase: "committed", status: receipt.status, saved: receipt.results.filter(r => r.archiveId).length }));
    if (receipt.status === "saved") break;
    if (receipt.results.some(r => r.error && r.error !== "IMPORT_CONTINUE_REQUIRED")) throw Error("Original commit verification failed");
  }
  if (receipt.status !== "saved" || receipt.results.length !== 16) throw Error("Incomplete original registration");
  const results = [];
  for (const result of receipt.results) {
    const original = entries[result.index], item = await api.loadArchiveItem(access, result.archiveId);
    if (item.visibility !== "private" || item.review_status !== "pending" || item.assets.length !== 1) throw Error("Unexpected publication or asset count");
    const asset = item.assets[0];
    const { url } = await api.archiveDownload(access, item.id, asset.id);
    const response = await fetch(url); if (!response.ok) throw Error("Signed original download failed");
    const downloadedHash = hash(Buffer.from(await response.arrayBuffer()));
    if (downloadedHash !== original.descriptor.sha256 || asset.sha256 !== downloadedHash || asset.file_size !== original.bytes.length || asset.original_filename !== original.descriptor.name) throw Error("Storage round-trip mismatch");
    if (asset.mime_type === "text/plain" && (hash(Buffer.from(item.original_text, "utf8")) !== downloadedHash || item.original_text_sha256 !== downloadedHash)) throw Error("Database notice round-trip mismatch");
    await api.archiveRequest("event_archive_links?on_conflict=archive_item_id,target_kind,target_id,input_index", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ archive_item_id: item.id, target_kind: "event", target_id: manifest.bundle_id, input_index: original.source.source_order, created_by: access.email }) });
    let aiStatus = "not_requested", aiError;
    const existing = await api.archiveRequest(`event_archive_labels?archive_item_id=eq.${item.id}&origin=eq.ai&status=eq.review_required&limit=1`);
    if (existing.length) aiStatus = "saved";
    else try { await api.classifyArchive(access, item.id); aiStatus = "saved"; } catch (error) { aiStatus = "failed"; aiError = error.code || error.message; }
    // Source labels are retained separately even if AI is unavailable or differs.
    const supplied = { suggestedClub: "unclassified", itemType: asset.mime_type.startsWith("image/") ? "poster" : "notice", title: original.source.title_suggestion,
      organizerName: original.source.detected_organization, eventName: manifest.title, eventType: original.source.item_type, eventDate: manifest.event_date,
      language: original.source.language, academicTerm: null, tags: ["WELL, COME PALBOK FESTIVAL", original.source.topic_label], summary: null, confidence: 0 };
    const human = await api.archiveRequest(`event_archive_labels?archive_item_id=eq.${item.id}&origin=eq.human&limit=1`);
    if (!human.length) {
      if (aiStatus === "saved") await api.archiveRequest("event_archive_labels", { method: "POST", body: JSON.stringify({ archive_item_id: item.id, labels: { ...supplied, sourceAssetId: original.source.asset_id, source: "supplied_manifest_and_labels_csv" }, origin: "human", model: null, status: "source_metadata", created_by: access.email }) });
      else await api.saveLabels(access, item.id, supplied, "human");
    }
    results.push({ sourceId: original.source.asset_id, archiveId: item.id, assetId: asset.id, filename: asset.original_filename, storagePath: asset.original_storage_path, bytes: asset.file_size, sha256: downloadedHash, originalVerified: true, aiStatus, ...(aiError ? { aiError } : {}) });
    console.log(JSON.stringify({ phase: "verified_and_classified", sourceId: original.source.asset_id, archiveId: item.id, aiStatus, aiError }));
  }
  const retry = await api.prepareImport(access, input);
  if (retry.batch_id !== prepared.batch_id || retry.uploads.length || retry.results.length !== 16) throw Error("Same-request idempotency failed");
  const list = await api.listArchive(access, new URLSearchParams({ batch: prepared.batch_id }));
  const publicList = await api.listArchive({ email: "non-admin@example.invalid", clubs: [], readOnly: true, superAdmin: false }, new URLSearchParams({ batch: prepared.batch_id }));
  if (list.items.length !== 16 || publicList.items.length) throw Error("Collection count or private isolation failed");
  for (const entry of entries.filter(e => e.descriptor.mimeType === "text/plain")) {
    const text = new TextDecoder().decode(entry.bytes), query = text.includes("MYSTERY HORROR") ? "MYSTERY HORROR" : "WINE, JAZZ";
    const found = await api.listArchive(access, new URLSearchParams({ batch: prepared.batch_id, q: query }));
    if (!found.items.some(i => i.original_text === text)) throw Error("Original notice search failed");
  }
  const report = { bundleId: manifest.bundle_id, batchId: prepared.batch_id, projectId: "okcabiimxuhhhokqajjg", zipSha256, visibility: "private", fileCount: 16, imageCount: 14, noticeCount: 2,
    registered: results.length, registrationFailures: 0, hashesMatched: results.length, aiClassified: results.filter(r => r.aiStatus === "saved").length,
    sameRequestIdempotent: true, privateIsolation: true, originalNoticeSearch: true, deployed: false, merged: false, results };
  await mkdir("docs/receipts", { recursive: true });
  await writeFile(join("docs/receipts", "palbok-20261017-import.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ phase: "complete", ...report, results: undefined }));
}
