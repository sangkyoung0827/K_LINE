import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, listJejuReviews, saveJejuReview } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const placeId = new URL(request.url).searchParams.get("placeId") ?? "";
    return NextResponse.json({ reviews: await listJejuReviews(placeId, user.email) }, {
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
    return NextResponse.json({ review: await saveJejuReview({ body, displayName: user.name, email: user.email }) });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
