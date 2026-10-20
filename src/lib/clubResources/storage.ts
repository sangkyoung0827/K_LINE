import "server-only";

import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";
import { resourceExtension } from "./model";
import { validResourceHeader } from "./signature";

export function createResourceStorage(bucket: "ecc-resource-library" | "hanhwal-resource-library") {
if (!["ecc-resource-library", "hanhwal-resource-library"].includes(bucket)) throw new Error("Invalid resource bucket.");
function assertPath(path: string) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(path)) throw new Error("Invalid resource path.");
}

function storageHeaders() {
  const { serviceRoleKey } = getSupabaseConfig();
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
}

function storageUrl(path: string) {
  return `${getSupabaseConfig().url}/storage/v1/${path}`;
}

async function createResourceUploadUrl(path: string) {
  assertPath(path);
  const response = await fetch(storageUrl(`object/upload/sign/${bucket}/${path}`), {
    method: "POST",
    headers: { ...storageHeaders(), "Content-Type": "application/json" },
    body: "{}"
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  const data = await response.json() as { url?: string };
  const signedUrl = new URL(storageUrl("").replace(/\/$/, "") + data.url);
  if (!data.url || signedUrl.origin !== new URL(getSupabaseConfig().url).origin ||
      !signedUrl.pathname.endsWith(`/object/upload/sign/${bucket}/${path}`) ||
      !signedUrl.searchParams.get("token")) {
    throw new Error("Storage did not return a valid signed upload URL.");
  }
  return {
    signedUrl: signedUrl.toString(),
    token: signedUrl.searchParams.get("token")!,
    endpoint: new URL("/storage/v1/upload/resumable", signedUrl).toString()
  };
}

async function inspectResourceFile(path: string) {
  assertPath(path);
  const response = await fetch(storageUrl(`object/info/${bucket}/${path}`), {
    headers: storageHeaders(), cache: "no-store"
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  const data = await response.json() as { size?: number; content_type?: string; contentType?: string };
  return {
    sizeBytes: data.size,
    mimeType: (data.content_type || data.contentType || "").split(";")[0].trim()
  };
}

async function createResourceReadUrl(path: string, fileName: string, download: boolean) {
  assertPath(path);
  const response = await fetch(storageUrl(`object/sign/${bucket}/${path}`), {
    method: "POST",
    headers: { ...storageHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 })
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  const data = await response.json() as { signedURL?: string };
  if (!data.signedURL?.startsWith(`/object/sign/${bucket}/${path}`)) {
    throw new Error("Storage did not return a valid signed read URL.");
  }
  const signedUrl = new URL(storageUrl("").replace(/\/$/, "") + data.signedURL);
  if (download) signedUrl.searchParams.set("download", fileName);
  return signedUrl.toString();
}

async function deleteResourceFile(path: string) {
  assertPath(path);
  const response = await fetch(storageUrl(`object/${bucket}`), {
    method: "DELETE",
    headers: { ...storageHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [path] })
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
}

async function verifyResourceHeader(path: string, fileName: string) {
  assertPath(path);
  const response = await fetch(storageUrl(`object/authenticated/${bucket}/${path}`), {
    headers: { ...storageHeaders(), Range: "bytes=0-65535" }, cache: "no-store"
  });
  if (!response.ok || !response.body) throw new Error("Resource content verification unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (length < 65536) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, 65536-length);
      chunks.push(chunk); length += chunk.length;
    }
  } finally { await reader.cancel(); }
  return validResourceHeader(Buffer.concat(chunks), resourceExtension(fileName));
}
return { createResourceUploadUrl, inspectResourceFile, createResourceReadUrl, deleteResourceFile, verifyResourceHeader };
}
