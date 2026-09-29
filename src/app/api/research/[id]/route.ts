import { NextResponse } from "next/server";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";
import { isPublicResearch, toPublicResearchItem } from "@/lib/research/model";
import { cleanResearchInput, deleteResearchItem, getResearchEditorAccess, getResearchItem, isResearchId, ResearchInputError, sameOrigin, updateResearchItem } from "@/lib/research/server";
import { deleteResearchFiles } from "@/lib/research/storage";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof ResearchInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("Research item request failed", error);
  return NextResponse.json({ error: "Research item is unavailable." }, {
    status: error instanceof SupabaseConfigError || (error instanceof SupabaseRequestError && error.status === 404) ? 503 : 500
  });
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!isResearchId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const item = await getResearchItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const editor = await getResearchEditorAccess();
    if (!isPublicResearch(item) && !editor.canEdit) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ item: editor.canEdit ? item : toPublicResearchItem(item), canEdit: editor.canEdit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const editor = await getResearchEditorAccess();
    if (!editor.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResearchId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const existing = await getResearchItem(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const input = cleanResearchInput(await request.json() as Record<string, unknown>, existing.attachmentPaths.length > 0);
    if (existing.isSample && input.status === "published") {
      return NextResponse.json({ error: "Sample drafts cannot be published." }, { status: 400 });
    }
    const item = await updateResearchItem(id, {
      ...input,
      published_at: input.status === "published" ? existing.publishedAt || new Date().toISOString() : existing.publishedAt || null
    });
    return NextResponse.json({ item });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const editor = await getResearchEditorAccess();
    if (!editor.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResearchId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const existing = await getResearchItem(id);
    if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await deleteResearchItem(id);
    try { await deleteResearchFiles([existing.coverPath, ...existing.imagePaths, ...existing.attachmentPaths].filter(Boolean)); }
    catch (error) { console.error("Orphaned research files need cleanup", { id, error }); }
    return NextResponse.json({ deleted: true });
  } catch (error) { return errorResponse(error); }
}
