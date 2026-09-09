import { NextResponse } from "next/server";
import {
  createAlumniInquiry,
  listAlumniInquiries,
  patchAlumniInquiry
} from "@/lib/hanhwalAlumni";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { cleanText, SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("HANHWAL alumni inquiries API error", error);
  return NextResponse.json(
    {
      error:
        error instanceof SupabaseConfigError || error instanceof SupabaseRequestError
          ? "HANHWAL Alumni inquiry storage is not ready."
          : "HANHWAL Alumni inquiries are temporarily unavailable."
    },
    { status: error instanceof SupabaseConfigError ? 503 : 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();
    const inquiries = await listAlumniInquiries(access.isAdmin, access.email);

    return NextResponse.json({ access, inquiries });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isLoggedIn || !access.email) {
      return NextResponse.json(
        { error: "Google login is required before submitting an HANHWAL activity inquiry." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const inquiry = await createAlumniInquiry(body, access.email);

    return NextResponse.json(
      {
        inquiry,
        message:
          "Your inquiry has been submitted. HANHWAL officers will review it and contact you if participation is possible."
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = cleanText(body.id, 120);

    if (!id) {
      return NextResponse.json({ error: "Inquiry id is required." }, { status: 400 });
    }

    const inquiry = await patchAlumniInquiry({
      adminEmail: access.email,
      adminNote: body.admin_note ?? body.adminNote,
      id,
      status: body.status
    });

    return NextResponse.json({
      inquiry,
      inquiries: await listAlumniInquiries(true, access.email)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
