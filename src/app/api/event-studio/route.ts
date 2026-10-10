import { NextResponse } from "next/server";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { studioOperation } from "@/lib/eventStudio/service";
import { StudioError } from "@/lib/eventStudio/model";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new StudioError("INVALID_ORIGIN", 403);
    const raw = await request.text();
    if (raw.length > 60000) throw new StudioError("REQUEST_TOO_LARGE", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new StudioError("INVALID_REQUEST");
    const result = await studioOperation(await getStudioAccess(), body);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof StudioError ? error.code : "EVENT_STUDIO_UNAVAILABLE" },
      { status: error instanceof StudioError ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
