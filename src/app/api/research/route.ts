import { NextResponse } from "next/server";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";
import { cleanResearchInput, getResearchEditorAccess, insertResearchItem, listResearchItems, ResearchInputError, sameOrigin } from "@/lib/research/server";

export const dynamic = "force-dynamic";

function storageError(error: unknown) {
  if (error instanceof ResearchInputError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error("Research archive request failed", error);
  return NextResponse.json({ error: "Research archive is unavailable." }, {
    status: error instanceof SupabaseConfigError || (error instanceof SupabaseRequestError && error.status === 404) ? 503 : 500
  });
}

export async function GET(request: Request) {
  try {
    const manage = new URL(request.url).searchParams.get("manage") === "1";
    const editor = manage ? await getResearchEditorAccess() : undefined;
    if (manage) {
      if (!editor?.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    }
    return NextResponse.json({ items: await listResearchItems(manage, editor) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return storageError(error); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const editor = await getResearchEditorAccess();
    if (!editor.canEdit) return NextResponse.json({ error: "Research editor access required." }, { status: 403 });
    const input = cleanResearchInput(await request.json() as Record<string, unknown>);
    const item = await insertResearchItem({ ...input, ...(!editor.canManageAll ? { author_organization: "HANHWAL", related_organization_id: "hanhwal" } : {}), status: "draft", visibility: "private" }, editor.email);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) { return storageError(error); }
}
