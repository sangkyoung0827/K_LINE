import { NextResponse } from "next/server";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  return NextResponse.json({ edition: "WooHyukmon 4.0", mode: "private-developer", status: "experimental" });
}

