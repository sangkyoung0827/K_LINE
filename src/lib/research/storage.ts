import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";
import { researchDocumentType } from "./model";

export const researchBucket = "open-k-culture-research";
export const maxResearchFileBytes = 10 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
};

export function isValidResearchDocument(extension: string, bytes: Uint8Array) {
  const starts = (...header: number[]) => header.every((byte, index) => bytes[index] === byte);
  if (extension === "pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (["docx", "hwpx", "pptx"].includes(extension)) return starts(0x50, 0x4b);
  if (["hwp", "ppt"].includes(extension)) return starts(0xd0, 0xcf, 0x11, 0xe0);
  return false;
}

export function isValidResearchFile(file: File, bytes: Uint8Array) {
  if (!extensions[file.type] || file.size === 0 || file.size > maxResearchFileBytes) return false;
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

export async function createResearchDocumentUpload(itemId: string, fileName: string, size: number) {
  const type = researchDocumentType(fileName);
  if (!type || !Number.isInteger(size) || size < 1 || size > maxResearchFileBytes) {
    throw new Error("Choose a PDF, DOCX, HWP, HWPX, PPT, or PPTX file up to 10 MB.");
  }
  const path = `${itemId}/${randomUUID()}.${type.extension}`;
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/upload/sign/${researchBucket}/${path}`, {
    method: "POST",
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
    body: "{}"
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  const data = await response.json() as { url?: string };
  const signedUrl = new URL(`${config.url}/storage/v1${data.url || ""}`);
  if (!data.url?.startsWith(`/object/upload/sign/${researchBucket}/${path}?`) ||
      signedUrl.origin !== new URL(config.url).origin || !signedUrl.searchParams.get("token")) {
    throw new Error("Storage did not return a valid upload URL.");
  }
  return { path, signedUrl: signedUrl.toString(), mimeType: type.mimeType };
}

export async function verifyResearchDocument(path: string, expectedSize: number) {
  const extension = path.split(".").pop() || "";
  const type = researchDocumentType(`file.${extension}`);
  if (!type) return false;
  const config = getSupabaseConfig();
  const info = await fetch(`${config.url}/storage/v1/object/info/${researchBucket}/${path}`, {
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` }, cache: "no-store"
  });
  if (!info.ok) return false;
  const metadata = await info.json() as { size?: number; content_type?: string; contentType?: string };
  if (metadata.size !== expectedSize || (metadata.content_type || metadata.contentType || "").split(";")[0] !== type.mimeType) return false;
  const response = await fetchResearchFile(path);
  if (!response.ok) return false;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.length === expectedSize && bytes.length <= maxResearchFileBytes &&
    isValidResearchDocument(extension, bytes);
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
