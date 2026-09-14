import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import {
  createHanhwalStructuredActivity,
  listHanhwalStructured,
  updateHanhwalStructuredActivity
} from "@/lib/hanhwalStructuredServer";
import { HanhwalStructuredError } from "@/lib/hanhwalStructuredValidation";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof HanhwalStructuredError) {
    return NextResponse.json({ error: error.message, debugCode: error.code }, { status: error.status });
  }
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "Hanhwal storage is not configured." }, { status: 503 });
  }
  if (error instanceof SupabaseRequestError && (error.status === 404 || /PGRST205|schema cache/i.test(error.message))) {
    return NextResponse.json({ error: "Hanhwal structured application migration is not ready." }, { status: 503 });
  }
  console.error("HANHWAL structured activity error", error);
  return NextResponse.json({ error: "Hanhwal applications are temporarily unavailable." }, { status: 500 });
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();
    if (!access.isOfficialMember) {
      return NextResponse.json({ error: "Hanhwal official membership is required." }, { status: access.isLoggedIn ? 403 : 401 });
    }
    const result = await listHanhwalStructured({ canManage: access.isAdmin, email: access.email });
    return NextResponse.json({
      ...result,
      canManage: access.isAdmin && !isReadOnlyDeveloperEmail(access.email)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();
    if (!access.isAdmin || isReadOnlyDeveloperEmail(access.email)) return NextResponse.json({ error: "Only writable Hanhwal admins can create an application round." }, { status: 403 });
    const activity = await createHanhwalStructuredActivity(await request.json() as Record<string, unknown>, access.email);
    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();
    if (!access.isAdmin || isReadOnlyDeveloperEmail(access.email)) return NextResponse.json({ error: "Only writable Hanhwal admins can update an application round." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    const activity = await updateHanhwalStructuredActivity(id, body, access.email);
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
