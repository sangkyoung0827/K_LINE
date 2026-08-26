import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import {
  getCurrentJejuUser,
  JejuHttpError,
  listJejuExploreTracking,
  recordJejuExploreTrackPoint,
  startJejuExploreSession,
  stopJejuExploreSession
} from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json(await listJejuExploreTracking(user.email), { headers: privateHeaders });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "start") {
      return NextResponse.json(await startJejuExploreSession({
        accuracyMeters: body.accuracyMeters ?? body.accuracy_meters,
        email: user.email,
        latitude: body.latitude,
        longitude: body.longitude
      }), { status: 201, headers: privateHeaders });
    }

    if (action === "point") {
      return NextResponse.json(await recordJejuExploreTrackPoint({
        accuracyMeters: body.accuracyMeters ?? body.accuracy_meters,
        email: user.email,
        latitude: body.latitude,
        longitude: body.longitude,
        sessionId: body.sessionId ?? body.session_id
      }), { headers: privateHeaders });
    }

    if (action === "stop") {
      return NextResponse.json({ session: await stopJejuExploreSession({
        email: user.email,
        sessionId: body.sessionId ?? body.session_id
      }) }, { headers: privateHeaders });
    }

    throw new JejuHttpError("A valid exploration action is required.", 400, "JEJU_TRACK_ACTION_INVALID");
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
