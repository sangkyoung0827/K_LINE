import { NextResponse } from "next/server";
import {
  listHanhwalMemberRegistrations,
  patchHanhwalMemberRegistration
} from "@/lib/hanhwalMemberRegistrations";
import {
  approveHanhwalOfficialMember,
  getCurrentHanhwalAccess,
  revokeHanhwalOfficialMember
} from "@/lib/hanhwalAccess";
import {
  cleanText,
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
        error: "HANHWAL member registration storage is not configured yet.",
        debugCode: "HANHWAL_MEMBER_REGISTRATIONS_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const parsed = parseSupabaseError(error);
    console.error("HANHWAL member registrations Supabase error", {
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint,
      message: parsed.message ?? error.message,
      status: error.status
    });

    if (error.status === 404) {
      return NextResponse.json(
        {
          error: "HANHWAL member registration table is not ready yet.",
          debugCode: "HANHWAL_MEMBER_REGISTRATIONS_TABLE_NOT_READY"
        },
        { status: 503 }
      );
    }
  } else {
    console.error("HANHWAL member registrations API error", error);
  }

  return NextResponse.json(
    {
      error: "HANHWAL member registration storage is temporarily unavailable.",
      debugCode: "HANHWAL_MEMBER_REGISTRATIONS_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin) {
      return NextResponse.json(
        {
          error: "Admin access is required.",
          debugCode: "HANHWAL_MEMBER_REGISTRATIONS_FORBIDDEN"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const registrations = await listHanhwalMemberRegistrations();

    return NextResponse.json({
      access,
      registrations
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        {
          error: "Admin access is required.",
          debugCode: "HANHWAL_MEMBER_REGISTRATIONS_FORBIDDEN"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as {
      registrations?: Array<{
        adminNote?: unknown;
        id?: unknown;
        paymentConfirmed?: unknown;
      }>;
    };
    const updates = Array.isArray(body.registrations) ? body.registrations : [];
    const updated = [];

    for (const update of updates) {
      const id = cleanText(update.id, 120);

      if (!id) {
        continue;
      }

      const registration = await patchHanhwalMemberRegistration({
        adminEmail: access.email,
        adminNote: cleanText(update.adminNote, 1200),
        id,
        paymentConfirmed: Boolean(update.paymentConfirmed)
      });

      if (!registration) {
        continue;
      }

      if (registration.paymentConfirmed) {
        await approveHanhwalOfficialMember({
          approvedBy: access.email,
          avatarUrl: registration.googleAvatarUrl,
          email: registration.googleEmail,
          name: registration.googleName || registration.fullName
        });
      } else {
        await revokeHanhwalOfficialMember({
          email: registration.googleEmail,
          revokedBy: access.email
        });
      }

      updated.push(registration);
    }

    const registrations = await listHanhwalMemberRegistrations();

    return NextResponse.json({
      registrations,
      updatedCount: updated.length
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
