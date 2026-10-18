import { NextResponse } from "next/server";
import { assertClubAccess, getGoogleFormsAccess, GoogleFormsAuthorizationError } from "@/lib/googleForms/access";
import { closeGoogleFormIfNeeded, registryColumns, syncGoogleFormResponses } from "@/lib/googleForms/googleApi";
import { automationPolicy, responseAdmission } from "@/lib/googleForms/automationPolicy";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { supabaseRequest } from "@/lib/googleForms/store";

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
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    if (!access.manageableClubs.length) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
    const form = await registry((await context.params).id); if (!form) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    assertClubAccess(access, form.club_key);
    // PostgREST defaults to 1,000 rows; never silently omit later applicants.
    const responses: ResponseRow[] = [];
    const snapshotFilter = automationPolicy(form) && form.last_response_sync_at ? `&synced_at=eq.${encodeURIComponent(form.last_response_sync_at)}` : "";
    for (let offset = 0; ; offset += 500) {
      const page = await supabaseRequest<ResponseRow[]>(`google_form_responses?select=id,google_response_id,submitted_at,respondent_email,matched_user_email,answers_json,synced_at&google_form_registry_id=eq.${encodeURIComponent(form.id)}${snapshotFilter}&order=submitted_at.asc,google_response_id.asc&limit=500&offset=${offset}`, { cache: "no-store" });
      responses.push(...page);
      if (page.length < 500) break;
      if (offset >= 100000) throw new Error("RESPONSE_PAGE_LIMIT");
    }
    if (automationPolicy(form) && form.last_response_sync_at) {
      const latest = await registry(form.id);
      if (!latest || latest.last_response_sync_at !== form.last_response_sync_at || responses.length !== form.response_count) return NextResponse.json({ error: "ROSTER_CHANGED_REFRESH_REQUIRED" }, { status: 409 });
    }
    const admission = responseAdmission(form, responses);
    return NextResponse.json({ form, responses: admission.accepted, waiting: admission.waiting, late: admission.late, source: "Google Forms" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}
export async function POST(_request: Request, context: Context) {
  try {
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    if (!access.manageableClubs.length) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
    const form = await registry((await context.params).id); if (!form) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    assertClubAccess(access, form.club_key, true);
    const count = await syncGoogleFormResponses(form);
    await closeGoogleFormIfNeeded(form.id);
    return NextResponse.json({ count, syncedAt: new Date().toISOString(), source: "Google Forms" });
  } catch (error) { return fail(error); }
}
