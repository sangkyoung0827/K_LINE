import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Parallel-development forms are not public application entry points.
  return NextResponse.json({ forms: [] }, { headers: { "Cache-Control": "no-store" } });
}
