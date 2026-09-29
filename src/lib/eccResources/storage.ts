import "server-only";

import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";

const bucket = "ecc-resource-library";

function storageHeaders() {
  const { serviceRoleKey } = getSupabaseConfig();
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
}

function storageUrl(path: string) {
  return `${getSupabaseConfig().url}/storage/v1/${path}`;
}

export async function createResourceUploadUrl(path: string) {
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

export async function inspectResourceFile(path: string) {
  const response = await fetch(storageUrl(`object/${bucket}/${path}`), {
    method: "HEAD", headers: storageHeaders(), cache: "no-store"
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
  return {
    sizeBytes: Number(response.headers.get("content-length")),
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || ""
  };
}

export async function createResourceReadUrl(path: string, fileName: string, download: boolean) {
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

export async function deleteResourceFile(path: string) {
  const response = await fetch(storageUrl(`object/${bucket}`), {
    method: "DELETE",
    headers: { ...storageHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [path] })
  });
  if (!response.ok) throw new SupabaseRequestError(await response.text(), response.status);
}
