import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { cleanText, supabaseRequest } from "@/lib/supabaseServer";
import { isResourceCategory, normalizeResourceCategory, validateResourceFile, canPreviewResource, type EccResource } from "@/lib/clubResources/model";
import { createResourceStorage } from "@/lib/clubResources/storage";
import { isResourceId, sameOrigin } from "@/lib/clubResources/http";

export const hanhwalResourceTable = "hanhwal_resource_files";
export const hanhwalStorage = createResourceStorage("hanhwal-resource-library");
export type ResourceAccess = { email: string; isMember: boolean; isAdmin: boolean; canUpload: boolean; canManage: boolean };
export type HanhwalResourceRow = {
  id: string; title: string; description: string; category: string;
  file_name: string; mime_type: string; size_bytes: number; storage_path: string;
  uploader_email: string; uploader_name: string; created_at: string;
  published_at: string | null; status: "uploading" | "pending" | "published" | "deleted";
  visibility: "public" | "members" | "staff"; revision: number;
};
class InputError extends Error {}
export async function getHanhwalResourceAccess(): Promise<ResourceAccess> {
  const access = await getCurrentHanhwalAccess();
  const writable = !isReadOnlyDeveloperEmail(access.email);
  return { email: access.email, isMember: access.isOfficialMember, isAdmin: access.isAdmin,
    canUpload: access.isOfficialMember && writable, canManage: access.isAdmin && writable };
}
export function canReadResource(row: HanhwalResourceRow, access: ResourceAccess) {
  if (row.status === "deleted" || row.status === "uploading") return false;
  if (access.isAdmin) return true;
  if (row.status === "pending") return Boolean(access.email && row.uploader_email === access.email);
  return row.status === "published" && (row.visibility === "public" || (row.visibility === "members" && access.isMember));
}
export function publicResource(row: HanhwalResourceRow): EccResource {
  return { id: row.id, title: row.title, description: row.description,
    category: normalizeResourceCategory(row.category, "hanhwal"),
    fileName: row.file_name, mimeType: row.mime_type, sizeBytes: row.size_bytes,
    uploaderName: row.uploader_name, createdAt: row.created_at,
    publishedAt: row.published_at || row.created_at, status: row.status,
    visibility: row.visibility, revision: row.revision };
}
async function getRow(id: string) {
  const rows = await supabaseRequest<HanhwalResourceRow[]>(`${hanhwalResourceTable}?id=eq.${id}&select=*&limit=1`, { cache: "no-store" });
  return rows[0] || null;
}
async function list(access: ResourceAccess) {
  const conditions = ["and(status.eq.published,visibility.eq.public)"];
  if (access.isMember) conditions.push("and(status.eq.published,visibility.eq.members)");
  if (access.email) conditions.push(`and(status.eq.pending,uploader_email.eq."${access.email.replace(/["\\]/g, "")}")`);
  const query = new URLSearchParams({select:"*", order:"created_at.desc", limit:"301"});
  if (access.isAdmin) query.set("status", "in.(pending,published)");
  else query.set("or", `(${conditions.join(",")})`);
  const rows = await supabaseRequest<HanhwalResourceRow[]>(`${hanhwalResourceTable}?${query}`, { cache: "no-store" });
  return { resources: rows.filter(row => canReadResource(row, access)).slice(0, 300).map(publicResource), hasMore: rows.length > 300 };
}
function validateEdit(input: Record<string, unknown>) {
  if (!isResourceCategory(input.category, "hanhwal")) throw new InputError("INVALID_CATEGORY");
  if (!["public", "members", "staff"].includes(String(input.visibility))) throw new InputError("INVALID_VISIBILITY");
  const title = cleanText(input.title, 180);
  if (!title) throw new InputError("TITLE_REQUIRED");
  return { title, description: cleanText(input.description, 2000), category: input.category, visibility: input.visibility };
}
async function jsonInput(request: Request) {
  if (Number(request.headers.get("content-length")) > 16000) throw new InputError("INVALID_REQUEST");
  const text = await request.text();
  if (Buffer.byteLength(text) > 16000) throw new InputError("INVALID_REQUEST");
  try { const data = JSON.parse(text); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; }
  catch { throw new InputError("INVALID_REQUEST"); }
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}
export async function handleHanhwalResource(request: Request, segments: string[] = []) {
  try {
    if (request.method !== "GET" && !sameOrigin(request)) return json({error:"INVALID_ORIGIN"},403);
    const access = await getHanhwalResourceAccess();
    const [id, action] = segments;
    if (segments.length > 2 || (action && !["publish","approve","file"].includes(action))) return json({error:"NOT_FOUND"},404);
    if (!id && request.method === "GET") return json(await list(access));
    if (!id && request.method === "POST") {
      if (!access.canUpload) return json({error:"OFFICIAL_MEMBERSHIP_REQUIRED"},403);
      const input = await jsonInput(request);
      const edit = validateEdit({...input, category:input.category ?? "other", visibility:"public"});
      let file: ReturnType<typeof validateResourceFile>;
      try { file = validateResourceFile(input.fileName, input.sizeBytes, input.mimeType); }
      catch { throw new InputError("INVALID_FILE"); }
      const session = await auth(), resourceId = randomUUID();
      const rows = await supabaseRequest<HanhwalResourceRow[]>(`${hanhwalResourceTable}?select=*`, {
        method:"POST", headers:{Prefer:"return=representation"}, body:JSON.stringify({
          ...edit, id:resourceId, file_name:file.fileName, mime_type:file.mimeType, size_bytes:file.sizeBytes,
          storage_path:`${resourceId}/${randomUUID()}.${file.extension}`, uploader_email:access.email,
          uploader_name:cleanText(session?.user?.name,120), status:"uploading"
        })
      });
      const row = rows[0];
      if (!row) throw new Error("INSERT_FAILED");
      try {
        const ticket = await hanhwalStorage.createResourceUploadUrl(row.storage_path);
        return json({id:row.id,storagePath:row.storage_path,signedUrl:ticket.signedUrl,uploadToken:ticket.token,uploadEndpoint:ticket.endpoint,mimeType:row.mime_type},201);
      } catch(error) {
        await supabaseRequest(`${hanhwalResourceTable}?id=eq.${row.id}&status=eq.uploading`, {method:"DELETE"});
        throw error;
      }
    }
    if (!id || !isResourceId(id)) return json({error:"NOT_FOUND"},404);
    // Mutations check roles before any row lookup, including foreign-club UUIDs.
    if (request.method !== "GET" && action !== "publish" && !access.canManage) return json({error:"FORBIDDEN"},403);
    if (action === "publish" && !access.canUpload) return json({error:"OFFICIAL_MEMBERSHIP_REQUIRED"},403);
    const row = await getRow(id);
    if (!row) return json({error:"NOT_FOUND"},404);
    if (request.method === "GET") {
      if (!canReadResource(row, access)) return json({error:"NOT_FOUND"},404);
      if (!action) return json({resource:publicResource(row)});
      if (action !== "file") return json({error:"NOT_FOUND"},404);
      const download = new URL(request.url).searchParams.has("download") || !canPreviewResource(row.mime_type);
      return NextResponse.redirect(await hanhwalStorage.createResourceReadUrl(row.storage_path,row.file_name,download), {
        status:302, headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer",Vary:"Cookie, Authorization"}
      });
    }
    if (action === "publish" && request.method === "POST") {
      if (row.uploader_email !== access.email || row.status !== "uploading") return json({error:"NOT_FOUND"},404);
      const stored = await hanhwalStorage.inspectResourceFile(row.storage_path);
      if (stored.sizeBytes !== row.size_bytes || stored.mimeType !== row.mime_type) return json({error:"FILE_VERIFICATION_FAILED"},400);
      if (!await hanhwalStorage.verifyResourceHeader(row.storage_path,row.file_name)) return json({error:"FILE_VERIFICATION_FAILED"},400);
      const rows = await supabaseRequest<HanhwalResourceRow[]>(`${hanhwalResourceTable}?id=eq.${id}&status=eq.uploading&revision=eq.${row.revision}&select=*`, {
        method:"PATCH",headers:{Prefer:"return=representation"}, body:JSON.stringify({status:"pending",revision:row.revision+1})
      });
      if (!rows[0]) return json({error:"REVISION_CONFLICT"},409);
      return json({resource:publicResource(rows[0])});
    }
    if (!action && request.method === "DELETE") {
      await supabaseRequest(`${hanhwalResourceTable}?id=eq.${id}`,{method:"PATCH",body:JSON.stringify({status:"deleted",revision:row.revision+1})});
      await hanhwalStorage.deleteResourceFile(row.storage_path);
      return json({deleted:true});
    }
    if (row.status === "deleted" || row.status === "uploading") return json({error:"NOT_FOUND"},404);
    if ((!action && request.method === "PATCH") || (action === "approve" && request.method === "POST")) {
      const input = await jsonInput(request);
      if (!Number.isInteger(input.revision) || input.revision !== row.revision) return json({error:"REVISION_CONFLICT"},409);
      const change = action === "approve" ? {status:"published",published_at:new Date().toISOString(),reviewed_by:access.email} : validateEdit(input);
      const rows = await supabaseRequest<HanhwalResourceRow[]>(`${hanhwalResourceTable}?id=eq.${id}&revision=eq.${row.revision}&status=eq.${row.status}&select=*`, {
        method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({...change,revision:row.revision+1})
      });
      if (!rows[0]) return json({error:"REVISION_CONFLICT"},409);
      return json({resource:publicResource(rows[0])});
    }
    return json({error:"METHOD_NOT_ALLOWED"},405);
  } catch(error) {
    if (error instanceof InputError) return json({error:error.message},400);
    console.error("Hanhwal resource request failed", error instanceof Error ? error.name : "unknown");
    return json({error:"RESOURCE_UNAVAILABLE"},503);
  }
}
