import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCurrentHanhwalAccess());
}
