import "server-only";

import { getSupabaseConfig } from "@/lib/supabaseServer";

export const knowledgeBucket = "woohyukmon-knowledge";

function storageHeaders(contentType?: string) {
  const config = getSupabaseConfig();
  const headers = new Headers({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`
  });
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

export async function ensureKnowledgeBucket() {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders("application/json"),
    body: JSON.stringify({
      file_size_limit: null,
      id: knowledgeBucket,
      name: knowledgeBucket,
      public: false
    })
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Knowledge bucket could not be prepared: ${await response.text()}`);
  }
}

export async function createKnowledgeSignedUpload(path: string) {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/upload/sign/${knowledgeBucket}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: storageHeaders("application/json"),
      body: JSON.stringify({ upsert: false })
    }
  );

  if (!response.ok) {
    throw new Error(`Signed upload URL could not be created: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    token?: string;
    url?: string;
    signedURL?: string;
  };
  const signedPath = payload.signedURL ?? payload.url;
  if (!signedPath) throw new Error("Supabase did not return a signed upload URL.");

  return {
    resumableUrl: `${config.url.replace(/https:\/\/([^.]+)\.supabase\.co$/i, "https://$1.storage.supabase.co")}/storage/v1/upload/resumable`,
    signedUrl: signedPath.startsWith("http")
      ? signedPath
      : `${config.url}/storage/v1${signedPath}`,
    token: payload.token ?? ""
  };
}

export async function downloadKnowledgeObject(path: string) {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/authenticated/${knowledgeBucket}/${encodeStoragePath(path)}`,
    { headers: storageHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Stored file could not be downloaded: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function knowledgeObjectExists(path: string) {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/authenticated/${knowledgeBucket}/${encodeStoragePath(path)}`,
    { headers: { ...Object.fromEntries(storageHeaders()), Range: "bytes=0-0" } }
  );
  return response.ok;
}

export async function createKnowledgePreviewUrl(path: string, expiresIn = 900) {
  const config = getSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${knowledgeBucket}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: storageHeaders("application/json"),
      body: JSON.stringify({ expiresIn })
    }
  );

  if (!response.ok) return "";
  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL ?? payload.signedUrl ?? "";
  return signedPath.startsWith("http") ? signedPath : signedPath ? `${config.url}/storage/v1${signedPath}` : "";
}

export async function deleteKnowledgeObject(path: string) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${knowledgeBucket}`, {
    method: "DELETE",
    headers: storageHeaders("application/json"),
    body: JSON.stringify({ prefixes: [path] })
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Stored file could not be deleted: ${await response.text()}`);
  }
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
