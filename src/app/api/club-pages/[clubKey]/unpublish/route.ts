import { handleClubRequest, type ClubRouteContext } from "@/lib/club-page/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function POST(request: Request, context: ClubRouteContext) {
  return handleClubRequest(request, context, "unpublish");
}
