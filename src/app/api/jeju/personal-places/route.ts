import { NextResponse } from "next/server";
import { jejuErrorResponse } from "@/lib/jeju/http";
import { getCurrentJejuUser, listJejuPersonalPlaceRecords, saveJejuPersonalPlaceRecord } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json({ records: await listJejuPersonalPlaceRecords(user.email) }, { headers: privateHeaders });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ record: await saveJejuPersonalPlaceRecord({ body, email: user.email }) }, {
      headers: privateHeaders,
      status: 201
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
