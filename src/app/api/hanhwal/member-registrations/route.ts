import { NextResponse } from "next/server";
import { listHanhwalMemberRegistrations } from "@/lib/hanhwalMemberRegistrations";
import { applyHanhwalMemberAdminUpdate } from "@/lib/hanhwalMemberAdminActions";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
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
      responseMode?: string;
      registrations?: Array<{
        adminNote?: unknown;
        id?: unknown;
        paymentConfirmed?: unknown;
      }>;
    };
    const updates = Array.isArray(body.registrations) ? body.registrations : [];
    if (updates.length > 1000 || updates.some((update) => !update ||
      (update.paymentConfirmed !== undefined && typeof update.paymentConfirmed !== "boolean") ||
      (update.adminNote !== undefined && typeof update.adminNote !== "string"))) {
      return NextResponse.json({ error: "Invalid member registration changes." }, { status: 400 });
    }
    const updated = [];
    let updatedCount = 0;
    const seen = new Set<string>();

    for (const update of updates) {
      const id = cleanText(update.id, 120);

      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);

      const result = await applyHanhwalMemberAdminUpdate({
        adminEmail: access.email,
        adminNote: update.adminNote === undefined ? undefined : cleanText(update.adminNote, 1200),
        id,
        paymentConfirmed: update.paymentConfirmed as boolean | undefined
      });
      const registration = result.registration;

      if (!registration) {
        continue;
      }

      if (result.changed) updatedCount++;
      updated.push(registration);
    }

    return NextResponse.json({
      ...(body.responseMode === "changes" ? {} : { registrations: await listHanhwalMemberRegistrations() }),
      updatedRegistrations: updated,
      updatedCount
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
