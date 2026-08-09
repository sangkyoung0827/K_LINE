import { NextResponse } from "next/server";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  // Brokerage credentials are now kept only in the registered MacBook's
  // loopback bridge. This endpoint deliberately never calls Toss from Vercel.
  return NextResponse.json({
    state: "local_bridge_required",
    provider: "Toss Securities",
    message: "Open WooHyukmon 4.0 on the registered MacBook and start its local Toss bridge."
  }, { status: 409 });
}
