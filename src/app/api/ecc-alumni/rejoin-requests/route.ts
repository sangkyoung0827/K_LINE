import { NextResponse } from "next/server";
import {
  createRejoinRequest,
  hasPreviousEccHistory,
  listRejoinRequests,
  patchRejoinRequest
} from "@/lib/eccAlumni";
import { approveEccOfficialMember, getCurrentEccAccess } from "@/lib/eccAccess";
import { cleanText, SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("ECC rejoin requests API error", error);
  return NextResponse.json(
    {
      error:
        error instanceof SupabaseConfigError || error instanceof SupabaseRequestError
          ? "ECC rejoin request storage is not ready."
          : "ECC rejoin requests are temporarily unavailable."
    },
    { status: error instanceof SupabaseConfigError ? 503 : 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();
    const requests = await listRejoinRequests(access.isAdmin, access.email);
    const eligible = await hasPreviousEccHistory(access.email);

    return NextResponse.json({ access, eligible, requests });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isLoggedIn || !access.email) {
      return NextResponse.json(
        { error: "Google login is required before submitting a rejoin request." },
        { status: 401 }
      );
    }

    if (!(await hasPreviousEccHistory(access.email))) {
      return NextResponse.json(
        {
          error: "If you are new to ECC, please use New Member Registration instead.",
          redirectTo: "/ecc-join"
        },
        { status: 403 }
      );
    }

    const requestBody = (await request.json()) as Record<string, unknown>;
    const rejoinRequest = await createRejoinRequest(requestBody);

    return NextResponse.json({ request: rejoinRequest }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = cleanText(body.id, 120);

    if (!id) {
      return NextResponse.json({ error: "Rejoin request id is required." }, { status: 400 });
    }

    const updated = await patchRejoinRequest({
      adminEmail: access.email,
      adminNote: body.admin_note ?? body.adminNote,
      id,
      paymentConfirmed: body.payment_confirmed ?? body.paymentConfirmed,
      status: body.status
    });

    if (updated?.status === "approved" && updated.payment_confirmed) {
      await approveEccOfficialMember({
        approvedBy: access.email,
        avatarUrl: updated.google_avatar_url ?? "",
        email: updated.google_email,
        name: updated.google_name || updated.full_name
      });
    }

    return NextResponse.json({
      request: updated,
      requests: await listRejoinRequests(true, access.email)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
