import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";

export const researchBucket = "open-k-culture-research";
const maxBytes = 10 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};

export function isValidResearchFile(file: File, bytes: Uint8Array) {
  if (!extensions[file.type] || file.size === 0 || file.size > maxBytes) return false;
  const starts = (...header: number[]) => header.every((byte, index) => bytes[index] === byte);
  if (file.type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (file.type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (file.type === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (file.type === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46);
  return starts(0x50, 0x4b);
}

export async function uploadResearchFile(itemId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isValidResearchFile(file, bytes)) throw new Error("Unsupported file or file exceeds 10 MB.");
  const name = `${randomUUID()}.${extensions[file.type]}`;
  const path = `${itemId}/${name}`;
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${researchBucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": file.type, "x-upsert": "false"
    },
    body: Buffer.from(bytes)
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  return path;
}

export async function fetchResearchFile(path: string) {
  const config = getSupabaseConfig();
  return fetch(`${config.url}/storage/v1/object/authenticated/${researchBucket}/${path}`, {
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` }
  });
}

export async function deleteResearchFiles(paths: string[]) {
  if (!paths.length) return;
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${researchBucket}`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prefixes: paths })
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
}
