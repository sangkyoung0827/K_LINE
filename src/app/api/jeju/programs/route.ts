import { NextResponse } from "next/server";
import { jejuAdminDenied, jejuErrorResponse } from "@/lib/jeju/http";
import { createJejuProgram, getCurrentJejuUser, listJejuPrograms } from "@/lib/jeju/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentJejuUser();
    return NextResponse.json({ programs: await listJejuPrograms(user.email, user.access.isAdmin), access: user.access }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentJejuUser();
    if (!user.access.isAdmin) return jejuAdminDenied(true);
    const body = (await request.json()) as Record<string, unknown>;
    return NextResponse.json({ program: await createJejuProgram(body, user.email) }, { status: 201 });
  } catch (error) {
    return jejuErrorResponse(error);
  }
}
