import "server-only";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";
import { type EccResource, validateResourceFile } from "./model";

const table = "ecc_resource_files";
const columns = "id,title,description,file_name,mime_type,size_bytes,storage_path,uploader_email,uploader_name,status,created_at,published_at";

export type ResourceRow = {
  id: string; title: string; description: string; file_name: string; mime_type: string;
  size_bytes: number; storage_path: string; uploader_email: string; uploader_name: string;
  status: "pending" | "published"; created_at: string; published_at: string | null;
};

export class ResourceInputError extends Error {}

export function isResourceId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function getResourceAccess() {
  const access = await getCurrentEccAccess();
  const readOnly = isReadOnlyDeveloperEmail(access.email);
  return {
    email: access.email,
    canUpload: access.isOfficialMember && !access.lookupFailed && !readOnly,
    isAdmin: access.isAdmin && !access.lookupFailed && !readOnly
  };
}

export function toPublicResource(row: ResourceRow): EccResource {
  return {
    id: row.id, title: row.title, description: row.description,
    fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes,
    uploaderName: row.uploader_name, createdAt: row.created_at,
    publishedAt: row.published_at || row.created_at
  };
}

export async function listResources() {
  const rows = await supabaseRequest<ResourceRow[]>(
    `${table}?select=${columns}&status=eq.published&order=published_at.desc&limit=300`,
    { cache: "no-store" }
  );
  return rows.filter((row) => row.status === "published").map(toPublicResource);
}

export async function getResource(id: string) {
  const rows = await supabaseRequest<ResourceRow[]>(
    `${table}?select=${columns}&id=eq.${encodeURIComponent(id)}&limit=1`,
    { cache: "no-store" }
  );
  return rows[0] || null;
}

export async function createPendingResource(input: Record<string, unknown>, email: string) {
  const title = cleanText(input.title, 180);
  if (!title) throw new ResourceInputError("A title is required.");
  let file: ReturnType<typeof validateResourceFile>;
  try { file = validateResourceFile(input.fileName, input.sizeBytes, input.mimeType); }
  catch (error) { throw new ResourceInputError(error instanceof Error ? error.message : "Invalid file."); }
  const session = await auth();
  const id = randomUUID();
  const path = `${id}/${randomUUID()}.${file.extension}`;
  const rows = await supabaseRequest<ResourceRow[]>(`${table}?select=${columns}`, {
    method: "POST", headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id, title, description: cleanText(input.description, 2000),
      file_name: file.fileName, mime_type: file.mimeType,
      size_bytes: file.sizeBytes, storage_path: path,
      uploader_email: email, uploader_name: cleanText(session?.user?.name, 120),
      status: "pending"
    })
  });
  return rows[0];
}

export async function publishResource(id: string) {
  const rows = await supabaseRequest<ResourceRow[]>(
    `${table}?id=eq.${encodeURIComponent(id)}&status=eq.pending&select=${columns}`,
    { method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }) }
  );
  return rows[0] || null;
}

export async function deleteResource(id: string) {
  await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}
