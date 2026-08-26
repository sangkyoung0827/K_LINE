import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import { createJejuPlace, getCurrentJejuUser, listJejuPlaces } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getCurrentJejuUser();
    return NextResponse.json({ places: await listJejuPlaces() }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    const body = (await request.json()) as Record<string, unknown>;
    const place = await createJejuPlace(body, user.email);
    return NextResponse.json({ place }, { status: 201 });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
