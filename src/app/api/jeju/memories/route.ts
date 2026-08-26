import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, listJejuMemories } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json({ memories: await listJejuMemories(user.email) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
