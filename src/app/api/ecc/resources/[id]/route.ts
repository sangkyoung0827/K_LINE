import { NextResponse } from "next/server";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";
import { deleteResource, getResource, getResourceAccess, isResourceId, ResourceInputError, sameOrigin, toPublicResource, updateResourceCategory } from "@/lib/eccResources/server";
import { deleteResourceFile } from "@/lib/eccResources/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

function failure(error: unknown) {
  if (error instanceof ResourceInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("ECC resource request failed", error);
  const unavailable = error instanceof SupabaseConfigError || error instanceof SupabaseRequestError && error.status === 404;
  return NextResponse.json({ error: "ECC resource is temporarily unavailable." }, { status: unavailable ? 503 : 500 });
}

export async function PATCH(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const access = await getResourceAccess();
    if (!access.isAdmin) return NextResponse.json({ error: "ECC administrator access is required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResourceId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const input = await request.json() as Record<string, unknown>;
    const row = await updateResourceCategory(id, input.category);
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ resource: toPublicResource(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!isResourceId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const row = await getResource(id);
    if (!row || row.status !== "published") return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ resource: toPublicResource(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const access = await getResourceAccess();
    if (!access.isAdmin) return NextResponse.json({ error: "ECC administrator access is required." }, { status: 403 });
    const { id } = await context.params;
    if (!isResourceId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const row = await getResource(id);
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await deleteResource(id);
    try { await deleteResourceFile(row.storage_path); }
    catch (error) { console.error("Orphaned ECC resource file needs cleanup", { id, error }); }
    return NextResponse.json({ deleted: true });
  } catch (error) { return failure(error); }
}
