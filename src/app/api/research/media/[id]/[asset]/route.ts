import { NextResponse } from "next/server";
import { isPublicResearch } from "@/lib/research/model";
import { researchDocumentType } from "@/lib/research/model";
import { getResearchEditorAccess, getResearchItem, isResearchId } from "@/lib/research/server";
import { fetchResearchFile } from "@/lib/research/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; asset: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id, asset } = await context.params;
    if (!isResearchId(id) || !/^[0-9a-f-]{36}\.(jpg|png|webp|pdf|docx|hwp|hwpx|ppt|pptx)$/i.test(asset)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const item = await getResearchItem(id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const path = `${id}/${asset}`;
    if (![item.coverPath, ...item.imagePaths, ...item.attachmentPaths].includes(path)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (!isPublicResearch(item) && !(await getResearchEditorAccess()).canEdit) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const stored = await fetchResearchFile(path);
    if (!stored.ok || !stored.body) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const type = researchDocumentType(asset)?.mimeType || (asset.endsWith(".png") ? "image/png" : asset.endsWith(".webp") ? "image/webp" : "image/jpeg");
    return new Response(stored.body, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `${type === "application/pdf" || type.startsWith("image/") ? "inline" : "attachment"}; filename="${asset}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Research media read failed", error);
    return NextResponse.json({ error: "Research media unavailable." }, { status: 500 });
  }
}
