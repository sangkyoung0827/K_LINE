import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCurrentEccAccess());
}
