import { NextResponse } from "next/server";
import { requireKnowledgeDeveloperApi } from "@/lib/knowledge/access";
import { getKnowledgeFileDetail, removeKnowledgeFileRecord } from "@/lib/knowledge/repository";
import { createKnowledgePreviewUrl, deleteKnowledgeObject } from "@/lib/knowledge/storage";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ fileId: string }> };

export async function GET(_: Request, context: Context) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  const { fileId } = await context.params;
  try {
    const detail = await getKnowledgeFileDetail(fileId);
    if (!detail.file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const previewUrl = await createKnowledgePreviewUrl(detail.file.storage_path);
    return NextResponse.json({ ...detail, previewUrl });
  } catch (error) {
    console.error("Knowledge detail failed", { error, fileId });
    return NextResponse.json({ error: "File detail could not be loaded.", debugCode: "KNOWLEDGE_DETAIL_FAILED" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Context) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  const { fileId } = await context.params;
  try {
    const detail = await getKnowledgeFileDetail(fileId);
    if (!detail.file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    await deleteKnowledgeObject(detail.file.storage_path);
    await removeKnowledgeFileRecord(fileId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Knowledge delete failed", { error, fileId });
    return NextResponse.json({ error: "File could not be deleted.", debugCode: "KNOWLEDGE_DELETE_FAILED" }, { status: 500 });
  }
}
