import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess, GoogleFormsAuthorizationError, assertClubAccess } from "@/lib/googleForms/access";
import { createGoogleForm, getGoogleConnectionStatus, registryColumns } from "@/lib/googleForms/googleApi";
import { isGoogleFormClubKey, type GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { parseGoogleFormDraft } from "@/lib/googleForms/validation";
import { supabaseRequest } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof GoogleFormsAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Google Forms registry request failed", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: error instanceof Error ? error.message : "Google Forms 연결에 문제가 있습니다." }, { status: 500 });
}

export async function GET() {
  try {
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    const forms = access.manageableClubs.length ? await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&club_key=in.(${access.manageableClubs.join(",")})&order=created_at.desc`, { cache: "no-store" }) : [];
    const connection = access.canConnect || access.manageableClubs.length ? await getGoogleConnectionStatus().catch(() => ({ connected: false, accountEmail: "", scopes: [] })) : { connected: false, accountEmail: "", scopes: [] };
    return NextResponse.json({ access, connection, forms });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getGoogleFormsAccess();
    const draft = parseGoogleFormDraft(await request.json());
    assertClubAccess(access, draft.clubKey, true);
    draft.editorEmail = access.email;
    const supplied = request.headers.get("Idempotency-Key")?.trim() || "";
    const idempotencyKey = /^[a-zA-Z0-9_-]{16,120}$/.test(supplied) ? supplied : randomUUID();
    return NextResponse.json({ form: await createGoogleForm(draft, access.email, idempotencyKey) }, { status: 201 });
  } catch (error) { return failure(error); }
}
