import { NextResponse } from "next/server";
import { canPreviewResource } from "@/lib/eccResources/model";
import { getResource, isResourceId } from "@/lib/eccResources/server";
import { createResourceReadUrl } from "@/lib/eccResources/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!isResourceId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const row = await getResource(id);
    if (!row || row.status !== "published") return NextResponse.json({ error: "Not found." }, { status: 404 });
    const download = new URL(request.url).searchParams.has("download") || !canPreviewResource(row.mime_type);
    const url = await createResourceReadUrl(row.storage_path, row.file_name, download);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    console.error("ECC resource download failed", error);
    return NextResponse.json({ error: "File is temporarily unavailable." }, { status: 503 });
  }
}
