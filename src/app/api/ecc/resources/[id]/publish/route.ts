import { NextResponse } from "next/server";
import { getResource, getResourceAccess, isResourceId, publishResource, sameOrigin, toPublicResource } from "@/lib/eccResources/server";
import { inspectResourceFile } from "@/lib/eccResources/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const access = await getResourceAccess();
    if (!access.canUpload) return NextResponse.json({ error: "ECC official membership is required to upload." }, { status: 403 });
    const { id } = await context.params;
    if (!isResourceId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const row = await getResource(id);
    if (!row || row.uploader_email !== access.email || row.status !== "pending") {
      return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
    }
    const stored = await inspectResourceFile(row.storage_path);
    if (stored.sizeBytes !== row.size_bytes || stored.mimeType !== row.mime_type) {
      return NextResponse.json({ error: "Uploaded file size or type did not match." }, { status: 400 });
    }
    const published = await publishResource(id);
    if (!published) return NextResponse.json({ error: "Upload session already completed." }, { status: 409 });
    return NextResponse.json({ resource: toPublicResource(published) });
  } catch (error) {
    console.error("ECC resource publish failed", error);
    return NextResponse.json({ error: "File verification failed. Retry after the upload completes." }, { status: 503 });
  }
}
