import { NextResponse } from "next/server";
import { getGoogleFormsAccess, GoogleFormsAuthorizationError } from "@/lib/googleForms/access";
import { getGoogleConnectionStatus, registryColumns } from "@/lib/googleForms/googleApi";
import { type GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { supabaseRequest } from "@/lib/googleForms/store";
import { handleGoogleFormsOperation } from "@/lib/googleForms/gateway";
import { draftFromTemplate } from "@/lib/googleForms/templates";
import { cleanText } from "@/lib/supabaseServer";
import type { GoogleFormDraft } from "@/lib/googleForms/types";

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
    const input = await request.json();
    const draft = input?.presetOnly === true ? draftFromTemplate(
      cleanText(input.clubKey, 40) as GoogleFormDraft["clubKey"],
      cleanText(input.templateId, 80), cleanText(input.title, 200)
    ) : input;
    return (await handleGoogleFormsOperation({ action: "DRAFT_GOOGLE_FORM", draft }))!;
  } catch (error) { return failure(error); }
}
