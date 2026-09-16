import { NextResponse } from "next/server";
import { assertClubAccess, getGoogleFormsAccess, GoogleFormsAuthorizationError } from "@/lib/googleForms/access";
import { registryColumns, syncGoogleFormResponses } from "@/lib/googleForms/googleApi";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { supabaseRequest } from "@/lib/supabaseServer";

type Context = { params: Promise<{ id: string }> };
type ResponseRow = { id: string; google_response_id: string; submitted_at: string; respondent_email: string | null; matched_user_email: string | null; answers_json: Record<string, string[]>; synced_at: string };

async function registry(id: string) {
  const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${encodeURIComponent(id)}&limit=1`, { cache: "no-store" });
  return rows[0] || null;
}
function fail(error: unknown) {
  if (error instanceof GoogleFormsAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Google Form response request failed", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: error instanceof Error ? error.message : "Google Forms 연결에 문제가 있습니다." }, { status: 500 });
}
export async function GET(_request: Request, context: Context) {
  try {
    const form = await registry((await context.params).id); if (!form) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    assertClubAccess(await getGoogleFormsAccess(), form.club_key);
    const responses = await supabaseRequest<ResponseRow[]>(`google_form_responses?select=id,google_response_id,submitted_at,respondent_email,matched_user_email,answers_json,synced_at&google_form_registry_id=eq.${encodeURIComponent(form.id)}&order=submitted_at.desc`, { cache: "no-store" });
    return NextResponse.json({ form, responses, source: "Google Forms" });
  } catch (error) { return fail(error); }
}
export async function POST(_request: Request, context: Context) {
  try {
    const form = await registry((await context.params).id); if (!form) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    assertClubAccess(await getGoogleFormsAccess(), form.club_key, true);
    const count = await syncGoogleFormResponses(form);
    return NextResponse.json({ count, syncedAt: new Date().toISOString(), source: "Google Forms" });
  } catch (error) { return fail(error); }
}
