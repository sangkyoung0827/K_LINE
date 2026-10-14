import { getClubAssistantAccess } from "@/lib/woohyukmon/club-access";
import { loadSiteEvidence } from "@/lib/woohyukmon/site-evidence";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") || "").slice(0, 1000);
  return Response.json(await loadSiteEvidence(await getClubAssistantAccess(), request, query), { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
