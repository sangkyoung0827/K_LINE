import "server-only";
import { ArchiveError } from "./model";

export function archiveConfig() {
  if (process.env.EVENT_ARCHIVE_ENABLED !== "true") throw new ArchiveError("ARCHIVE_NOT_ENABLED", 503);
  const live = process.env.EVENT_ARCHIVE_ENVIRONMENT === "production";
  if (!live && process.env.EVENT_ARCHIVE_ENVIRONMENT !== "test") throw new ArchiveError("ARCHIVE_ENVIRONMENT_REQUIRED", 503);
  const url = (live ? process.env.SUPABASE_URL : process.env.EVENT_ARCHIVE_TEST_SUPABASE_URL)?.replace(/\/+$/, "");
  const key = live ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.EVENT_ARCHIVE_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !live && (new URL(url).hostname === "okcabiimxuhhhokqajjg.supabase.co" || url === process.env.SUPABASE_URL?.replace(/\/+$/, ""))) throw new ArchiveError("ISOLATED_ARCHIVE_DATABASE_REQUIRED", 503);
  return { url, key };
}
export async function archiveRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!/^(?:event_archive_(?:items|assets|labels|import_jobs|links|versions)(?:\?[^#]*)?|rpc\/event_archive_(?:reserve|claim|commit|label_reserve))$/.test(path)) throw new ArchiveError("ARCHIVE_TABLE_NOT_ALLOWED", 403);
  const { url, key } = archiveConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...Object.fromEntries(new Headers(init.headers)) } });
  if (!response.ok) {
    const message = await response.text();
    const code = ["IDEMPOTENCY_CONFLICT", "ARCHIVE_RATE_LIMIT", "IMPORT_BUSY"].find(c => message.includes(c));
    throw new ArchiveError(code || "ARCHIVE_DATABASE_UNAVAILABLE", code === "ARCHIVE_RATE_LIMIT" ? 429 : code ? 409 : 503);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
const objectPath = (path: string) => {
  if (!/^(ecc|hanhwal|social_impact_union|unclassified)\/[a-f0-9-]{36}\/\d+-[a-f0-9]{64}\.[a-z]+$/.test(path)) throw new ArchiveError("INVALID_STORAGE_PATH");
  return path;
};
async function storageRequest(path: string, init: RequestInit = {}) {
  const { url, key } = archiveConfig();
  return fetch(`${url}/storage/v1/${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...Object.fromEntries(new Headers(init.headers)) } });
}
export async function originalBytes(path: string, maximum = 25 * 1024 * 1024): Promise<Uint8Array> {
  const r = await storageRequest(`object/event-assets/${objectPath(path)}`);
  if (!r.ok) throw new ArchiveError(r.status === 404 ? "UPLOAD_NOT_RECEIVED" : "ARCHIVE_STORAGE_UNAVAILABLE", r.status === 404 ? 409 : 503);
  const reader = r.body?.getReader(); if (!reader) throw new ArchiveError("UPLOAD_NOT_RECEIVED", 409);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > maximum) { await reader.cancel(); throw new ArchiveError("FILE_TOO_LARGE", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function originalUploadUrl(path: string) {
  const r = await storageRequest(`object/upload/sign/event-assets/${objectPath(path)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!r.ok) throw new ArchiveError("ARCHIVE_STORAGE_UNAVAILABLE", 503);
  const data = await r.json() as { url?: string };
  if (!data.url?.startsWith(`/object/upload/sign/event-assets/${path}?`)) throw new ArchiveError("INVALID_STORAGE_RESPONSE", 503);
  return `${archiveConfig().url}/storage/v1${data.url}`;
}
export async function originalReadUrl(path: string, filename: string) {
  const r = await storageRequest(`object/sign/event-assets/${objectPath(path)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
  if (!r.ok) throw new ArchiveError("ARCHIVE_STORAGE_UNAVAILABLE", 503);
  const data = await r.json() as { signedURL?: string };
  if (!data.signedURL?.startsWith(`/object/sign/event-assets/${path}?`)) throw new ArchiveError("INVALID_STORAGE_RESPONSE", 503);
  const u = new URL(`${archiveConfig().url}/storage/v1${data.signedURL}`); u.searchParams.set("download", filename);
  return u.toString();
}
export async function removeTemporaryOriginal(path: string) {
  const r = await storageRequest("object/event-assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [objectPath(path)] }) });
  if (!r.ok) throw new ArchiveError("ORPHAN_CLEANUP_PENDING", 503);
}
