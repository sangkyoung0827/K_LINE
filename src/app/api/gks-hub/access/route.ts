import { NextResponse } from "next/server";
import { getGksHubAccess } from "@/lib/gksHub/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getGksHubAccess();
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (!access.allowed) {
    return NextResponse.json({ allowed: false }, { status: access.authenticated ? 403 : 401, headers });
  }
  return NextResponse.json({ allowed: true, draftKey: access.draftKey }, { headers });
}
