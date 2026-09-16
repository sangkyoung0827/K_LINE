import { NextResponse } from "next/server";
import { supabaseRequest } from "@/lib/supabaseServer";
import { isGoogleFormClubKey, type GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { registryColumns } from "@/lib/googleForms/googleApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const clubKey = params.get("club_key");
  const activityId = params.get("activity_id")?.trim() || "";
  if (!isGoogleFormClubKey(clubKey)) return NextResponse.json({ error: "INVALID_CLUB" }, { status: 400 });
  const query = new URLSearchParams({ select: registryColumns, club_key: `eq.${clubKey}`, status: "eq.open", order: "created_at.desc" });
  if (activityId) query.set("activity_id", `eq.${activityId}`);
  try {
    const forms = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?${query}`, { cache: "no-store" });
    return NextResponse.json({ forms: forms.map((form) => ({ id: form.id, activityId: form.activity_id, title: form.title, description: form.description, responderUrl: form.responder_url, deadline: form.application_deadline, responseCount: form.response_count })) }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ forms: [], setupRequired: true }, { status: 200 });
  }
}
