import { handleClubRequest, type ClubRouteContext } from "@/lib/club-page/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(request: Request, context: ClubRouteContext) {
  return handleClubRequest(request, context, "draft");
}
export function PUT(request: Request, context: ClubRouteContext) {
  return handleClubRequest(request, context, "draft");
}
