import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import {
  submitHanhwalStructured,
  updateHanhwalStructuredSubmission
} from "@/lib/hanhwalStructuredServer";
import { HanhwalStructuredError } from "@/lib/hanhwalStructuredValidation";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof HanhwalStructuredError) {
    return NextResponse.json({ error: error.message, debugCode: error.code }, { status: error.status });
  }
  if (error instanceof SupabaseConfigError) return NextResponse.json({ error: "Hanhwal storage is not configured." }, { status: 503 });
  if (error instanceof SupabaseRequestError && (error.status === 404 || /PGRST205|schema cache/i.test(error.message))) {
    return NextResponse.json({ error: "Hanhwal structured application migration is not ready." }, { status: 503 });
  }
  console.error("HANHWAL structured submission error", error);
  return NextResponse.json({ error: "The Hanhwal submission could not be saved." }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const [access, session] = await Promise.all([getCurrentHanhwalAccess(), auth()]);
    if (!access.isOfficialMember) {
      return NextResponse.json({ error: "Hanhwal official membership is required." }, { status: access.isLoggedIn ? 403 : 401 });
    }
    if (isReadOnlyDeveloperEmail(access.email)) {
      return NextResponse.json({ error: "This developer account has read-only access." }, { status: 403 });
    }
    const submission = await submitHanhwalStructured(
      await request.json() as Record<string, unknown>,
      { email: access.email, name: session?.user?.name?.trim() || access.email.split("@")[0] }
    );
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();
    if (!access.isOfficialMember) {
      return NextResponse.json({ error: "Hanhwal official membership is required." }, { status: access.isLoggedIn ? 403 : 401 });
    }
    if (isReadOnlyDeveloperEmail(access.email)) {
      return NextResponse.json({ error: "This developer account has read-only access." }, { status: 403 });
    }
    const submission = await updateHanhwalStructuredSubmission(
      await request.json() as Record<string, unknown>,
      { canManage: access.isAdmin, email: access.email }
    );
    return NextResponse.json({ submission });
  } catch (error) {
    return errorResponse(error);
  }
}
