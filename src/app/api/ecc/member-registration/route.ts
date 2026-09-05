import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  cleanEccMemberRegistrationFormInput,
  getEccMemberRegistrationByEmail,
  upsertEccMemberRegistration,
  validateEccMemberRegistrationForm
} from "@/lib/eccMemberRegistrations";
import {
  getCurrentEccAccess,
  getEccAccessForEmail,
  getEccOfficialTeamChatUrl
} from "@/lib/eccAccess";
import { getSiteMemberByEmail, registerSiteMember } from "@/lib/siteAnalytics";
import {
  SupabaseConfigError,
  SupabaseRequestError
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function parseSupabaseError(error: SupabaseRequestError) {
  try {
    return JSON.parse(error.message) as {
      code?: string;
      details?: string;
      hint?: string;
      message?: string;
    };
  } catch {
    return { message: error.message };
  }
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error: "ECC member registration storage is not configured yet.",
        debugCode: "ECC_MEMBER_REGISTRATION_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const parsed = parseSupabaseError(error);
    console.error("ECC member registration Supabase error", {
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint,
      message: parsed.message ?? error.message,
      status: error.status
    });

    if (error.status === 404) {
      return NextResponse.json(
        {
          error: "ECC member registration table is not ready yet.",
          debugCode: "ECC_MEMBER_REGISTRATION_TABLE_NOT_READY"
        },
        { status: 503 }
      );
    }
  } else {
    console.error("ECC member registration API error", error);
  }

  return NextResponse.json(
    {
      error: "ECC member registration storage is temporarily unavailable.",
      debugCode: "ECC_MEMBER_REGISTRATION_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isLoggedIn || !access.email) {
      return NextResponse.json({ error: "Login is required." }, { status: 401 });
    }

    const registration = await getEccMemberRegistrationByEmail(access.email);

    return NextResponse.json({
      access,
      registration
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Login is required." }, { status: 401 });
    }

    const [access, existing] = await Promise.all([
      getEccAccessForEmail(session.user.email),
      getEccMemberRegistrationByEmail(session.user.email)
    ]);

    if (!access.isLoggedIn || !access.email) {
      return NextResponse.json({ error: "Login is required." }, { status: 401 });
    }

    if (existing?.officialMember || existing?.status === "approved") {
      return NextResponse.json(
        {
          error: "This account is already approved as an ECC official member.",
          debugCode: "ECC_MEMBER_REGISTRATION_ALREADY_APPROVED"
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const form = cleanEccMemberRegistrationFormInput(body);
    const missing = validateEccMemberRegistrationForm(form);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Please fill in all required ECC registration fields.",
          debugCode: "ECC_MEMBER_REGISTRATION_VALIDATION_FAILED",
          missing
        },
        { status: 400 }
      );
    }

    let siteMemberId = existing?.siteMemberId ?? "";

    if (!siteMemberId) {
      const existingSiteMember = await getSiteMemberByEmail(access.email);

      if (existingSiteMember) {
        siteMemberId = existingSiteMember.id;
      } else {
        const siteMember = await registerSiteMember({
          email: session.user.email,
          imageUrl: session.user.image,
          name: session.user.name,
          provider: "google"
        });
        siteMemberId = siteMember?.id ?? "";
      }
    }

    const registration = await upsertEccMemberRegistration({
      existingRegistration: existing,
      form,
      googleAvatarUrl: session.user.image,
      googleEmail: access.email,
      googleName: session.user.name,
      siteMemberId
    });

    return NextResponse.json(
      {
        message:
          "Your ECC registration has been submitted. ECC officers will check your payment and approve your official membership soon.",
        registration,
        teamChatUrl: getEccOfficialTeamChatUrl()
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
