import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, getJejuPlaceDetail, updateJejuPlace } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentJejuUser();
    const { id } = await params;
    return NextResponse.json({ ...(await getJejuPlaceDetail(id, user.email)), access: user.access }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ place: await updateJejuPlace(id, body, user.email) });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
