import { NextResponse } from "next/server";
import { getResearchEditorAccess, getResearchItem, isResearchId, sameOrigin, updateResearchItem } from "@/lib/research/server";
import { createResearchDocumentUpload, deleteResearchFiles, uploadResearchFile, verifyResearchDocument } from "@/lib/research/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const editor = await getResearchEditorAccess();
    if (!editor.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResearchId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const item = await getResearchItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = await request.json() as { action?: string; fileName?: string; size?: number; path?: string };
      if (input.action === "ticket") {
        try {
          const ticket = await createResearchDocumentUpload(id, input.fileName || "", input.size || 0);
          return NextResponse.json(ticket);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Choose a")) return NextResponse.json({ error: error.message }, { status: 400 });
          throw error;
        }
      }
      if (input.action === "finalize") {
        const path = input.path || "";
        if (!new RegExp(`^${id}/[0-9a-f-]{36}\\.(pdf|docx|hwp|hwpx|ppt|pptx)$`, "i").test(path) ||
            !Number.isInteger(input.size) || !input.size || input.size > 10 * 1024 * 1024 ||
            item.attachmentPaths.includes(path)) {
          return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
        }
        if (!(await verifyResearchDocument(path, input.size))) {
          try { await deleteResearchFiles([path]); }
          catch (error) { console.error("Rejected research upload needs cleanup", { id, error }); }
          return NextResponse.json({ error: "The uploaded file could not be verified." }, { status: 400 });
        }
        try {
          const updated = await updateResearchItem(id, { attachment_paths: [...item.attachmentPaths, path] });
          return NextResponse.json({ item: updated });
        } catch (error) {
          try { await deleteResearchFiles([path]); }
          catch (cleanupError) { console.error("Failed research upload needs cleanup", { id, cleanupError }); }
          throw error;
        }
      }
      return NextResponse.json({ error: "Invalid upload action." }, { status: 400 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || !["cover", "image", "attachment"].includes(String(kind))) {
      return NextResponse.json({ error: "Choose a supported file and upload type." }, { status: 400 });
    }
    if ((kind === "cover" || kind === "image") && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return NextResponse.json({ error: "This field requires a JPEG, PNG, or WebP image." }, { status: 400 });
    }
    if (kind === "attachment") {
      return NextResponse.json({ error: "Use the signed document upload flow." }, { status: 400 });
    }
    let path: string;
    try { path = await uploadResearchFile(id, file); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith("Unsupported file")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    try {
      const patch = kind === "cover" ? { cover_path: path }
        : kind === "image" ? { image_paths: [...item.imagePaths, path] }
          : { attachment_paths: [...item.attachmentPaths, path] };
      const updated = await updateResearchItem(id, patch);
      if (kind === "cover" && item.coverPath) {
        try { await deleteResearchFiles([item.coverPath]); }
        catch (error) { console.error("Old research cover needs cleanup", { id, error }); }
      }
      return NextResponse.json({ item: updated }, { status: 201 });
    } catch (error) {
      await deleteResearchFiles([path]);
      throw error;
    }
  } catch (error) {
    console.error("Research file upload failed", error);
    return NextResponse.json({ error: "Research file could not be uploaded." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const editor = await getResearchEditorAccess();
    if (!editor.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResearchId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const item = await getResearchItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { path } = await request.json() as { path?: string };
    if (!path || ![item.coverPath, ...item.imagePaths, ...item.attachmentPaths].includes(path)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    if (item.status === "published" && item.attachmentPaths.includes(path) && item.attachmentPaths.length === 1 && !item.bodyKo && !item.bodyEn) {
      return NextResponse.json({ error: "Add another document or move this research to a draft before removing its only content." }, { status: 400 });
    }
    const updated = await updateResearchItem(id, {
      cover_path: item.coverPath === path ? "" : item.coverPath,
      image_paths: item.imagePaths.filter((value) => value !== path),
      attachment_paths: item.attachmentPaths.filter((value) => value !== path)
    });
    try { await deleteResearchFiles([path]); }
    catch (error) { console.error("Removed research file needs cleanup", { id, error }); }
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Research file removal failed", error);
    return NextResponse.json({ error: "Research file could not be removed." }, { status: 500 });
  }
}
