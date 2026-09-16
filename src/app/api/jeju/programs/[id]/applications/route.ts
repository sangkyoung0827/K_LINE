import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import {
  getCurrentJejuUser,
  listJejuProgramApplications
} from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    const { id } = await params;
    return NextResponse.json({ applications: await listJejuProgramApplications(id) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  void request; void params;
  return NextResponse.json({ error: "Native K_LINE application submission has been retired. Use the configured Google Form." }, { status: 410 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  void request; void params;
  return NextResponse.json({ error: "Historical K_LINE applications are read-only." }, { status: 410 });
}
