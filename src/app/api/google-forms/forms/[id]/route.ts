import { NextResponse } from "next/server";
import { assertClubAccess, getGoogleFormsAccess, GoogleFormsAuthorizationError } from "@/lib/googleForms/access";
import { registryColumns, setGoogleFormStatus } from "@/lib/googleForms/googleApi";
import { type GoogleFormRegistryRow, type GoogleFormStatus } from "@/lib/googleForms/types";
import { supabaseRequest } from "@/lib/supabaseServer";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${encodeURIComponent(id)}&limit=1`, { cache: "no-store" });
    if (!rows[0]) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const access = await getGoogleFormsAccess();
    assertClubAccess(access, rows[0].club_key, true);
    const status = (await request.json() as { status?: GoogleFormStatus }).status;
    if (!status || !["open", "closed", "archived"].includes(status)) return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    return NextResponse.json({ form: await setGoogleFormStatus(rows[0], status) });
  } catch (error) {
    if (error instanceof GoogleFormsAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Google Form status update failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Forms 연결에 문제가 있습니다." }, { status: 500 });
  }
}
