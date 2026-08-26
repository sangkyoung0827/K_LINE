import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, getJejuOverview } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    const overview = await getJejuOverview(user.email);
    return NextResponse.json({ ...overview, user: { image: user.image, name: user.name } }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
