import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import {
  applyToJejuProgram,
  getCurrentJejuUser,
  listJejuProgramApplications,
  updateJejuProgramApplication
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
  try {
    const user = await getCurrentJejuUser();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ application: await applyToJejuProgram({ body, email: user.email, name: user.name, programId: id }) }, { status: 201 });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    await params;
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({
      application: await updateJejuProgramApplication({
        adminNote: body.adminNote ?? body.admin_note,
        id: body.applicationId ?? body.id,
        status: body.status
      })
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
