import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, getJejuAdminDashboard } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    return NextResponse.json(await getJejuAdminDashboard(user.email), {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
