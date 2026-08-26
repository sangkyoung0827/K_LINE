import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { checkInToJejuPlace, getCurrentJejuUser, listJejuVisits } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json({ visits: await listJejuVisits(user.email) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const body = (await request.json()) as Record<string, unknown>;
    const result = await checkInToJejuPlace({
      email: user.email,
      latitude: body.latitude,
      longitude: body.longitude,
      placeId: body.placeId ?? body.place_id
    });
    return NextResponse.json(result, { status: result.success ? 201 : 200 });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
