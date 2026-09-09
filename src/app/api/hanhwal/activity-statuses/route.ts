import { NextResponse } from "next/server";
import { normalizeHanhwalActivityId } from "@/lib/hanhwalActivities";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { getHanhwalActivityCatalog } from "@/lib/hanhwalOperations";
import { getHanhwalActivityStatuses } from "@/lib/hanhwalActivityStatuses";
import { applyHanhwalActivityStatusAdminUpdate } from "@/lib/hanhwalActivityAdminActions";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function logStatusError(error: unknown) {
  console.error("HANHWAL activity status API error", {
    message: error instanceof Error ? error.message : "Unknown error",
    code:
      error instanceof SupabaseConfigError
        ? "HANHWAL_SUPABASE_CONFIG_MISSING"
        : "HANHWAL_ACTIVITY_STATUS_UNKNOWN"
  });
}

export async function GET() {
  try {
    return NextResponse.json(await getHanhwalActivityStatuses());
  } catch (error) {
    logStatusError(error);

    return NextResponse.json(
      {
        error: "HANHWAL activity status storage is temporarily unavailable.",
        debugCode:
          error instanceof SupabaseConfigError
            ? "HANHWAL_SUPABASE_CONFIG_MISSING"
            : "HANHWAL_ACTIVITY_STATUS_STORAGE_UNAVAILABLE"
      },
      { status: error instanceof SupabaseConfigError ? 503 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        {
          error: "Only HANHWAL admins can open or close activity applications.",
          debugCode: "HANHWAL_ACTIVITY_STATUS_FORBIDDEN"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const catalog = await getHanhwalActivityCatalog({ includeArchived: true });
    const activeIds = new Set(
      catalog.filter((item) => !item.archived).map((item) => item.id)
    );
    const body = (await request.json()) as {
      activity_id?: unknown;
      activityId?: unknown;
      is_open?: unknown;
      isOpen?: unknown;
      requires_payment?: unknown;
      requiresPayment?: unknown;
      statuses?: Record<string, unknown>;
      paymentRequirements?: Record<string, unknown>;
    };
    const updates: Record<string, boolean> = {};
    const paymentRequirements: Record<string, boolean> = {};

    if (body.statuses && typeof body.statuses === "object") {
      Object.entries(body.statuses).forEach(([key, value]) => {
        const activityId = normalizeHanhwalActivityId(key);

        if (activeIds.has(activityId) && typeof value === "boolean") {
          updates[activityId] = value;
        }
      });
    }

    if (body.paymentRequirements && typeof body.paymentRequirements === "object") {
      Object.entries(body.paymentRequirements).forEach(([key, value]) => {
        const activityId = normalizeHanhwalActivityId(key);

        if (activeIds.has(activityId) && typeof value === "boolean") {
          paymentRequirements[activityId] = value;
        }
      });
    }

    const directIdRaw = cleanText(body.activity_id ?? body.activityId, 80);
    const activityId = directIdRaw ? normalizeHanhwalActivityId(directIdRaw) : "";
    const directValue = body.is_open ?? body.isOpen;

    if (activityId && activeIds.has(activityId) && typeof directValue === "boolean") {
      updates[activityId] = directValue;
    }

    const directPaymentValue = body.requires_payment ?? body.requiresPayment;

    if (
      activityId &&
      activeIds.has(activityId) &&
      typeof directPaymentValue === "boolean"
    ) {
      paymentRequirements[activityId] = directPaymentValue;
    }

    if (
      Object.keys(updates).length === 0 &&
      Object.keys(paymentRequirements).length === 0
    ) {
      return NextResponse.json(
        {
          error: "No valid HANHWAL activity status update was provided.",
          debugCode: "HANHWAL_ACTIVITY_STATUS_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    const result = await applyHanhwalActivityStatusAdminUpdate({
      adminEmail: access.email,
      updates,
      paymentRequirements
    });

    return NextResponse.json(result);
  } catch (error) {
    logStatusError(error);

    return NextResponse.json(
      {
        error: "HANHWAL activity status could not be saved.",
        debugCode:
          error instanceof SupabaseRequestError && error.status === 404
            ? "HANHWAL_ACTIVITY_STATUS_TABLE_NOT_READY"
            : "HANHWAL_ACTIVITY_STATUS_SAVE_FAILED"
      },
      { status: error instanceof SupabaseConfigError ? 503 : 500 }
    );
  }
}
