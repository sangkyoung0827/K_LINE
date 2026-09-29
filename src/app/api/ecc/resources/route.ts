import { NextResponse } from "next/server";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";
import { createPendingResource, deleteResource, getResourceAccess, listResources, ResourceInputError, sameOrigin } from "@/lib/eccResources/server";
import { createResourceUploadUrl } from "@/lib/eccResources/storage";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof ResourceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("ECC resource library failed", error);
  const unavailable = error instanceof SupabaseConfigError || error instanceof SupabaseRequestError && error.status === 404;
  return NextResponse.json({ error: "ECC resources are temporarily unavailable." }, { status: unavailable ? 503 : 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ resources: await listResources() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const access = await getResourceAccess();
    if (!access.canUpload) return NextResponse.json({ error: "ECC official membership is required to upload." }, { status: 403 });
    const input = await request.json() as Record<string, unknown>;
    const pending = await createPendingResource(input, access.email);
    try {
      const signed = await createResourceUploadUrl(pending.storage_path);
      return NextResponse.json({
        id: pending.id, storagePath: pending.storage_path,
        uploadToken: signed.token, uploadEndpoint: signed.endpoint, signedUrl: signed.signedUrl,
        mimeType: pending.mime_type
      }, { status: 201 });
    } catch (error) {
      await deleteResource(pending.id);
      throw error;
    }
  } catch (error) { return failure(error); }
}
