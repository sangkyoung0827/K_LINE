import { NextResponse } from "next/server";
import { normalizeEccActivityId } from "@/lib/eccActivities";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getEccActivityCatalog } from "@/lib/eccOperations";
import {
  getEccActivityStatuses,
  updateEccActivityStatuses
} from "@/lib/eccActivityStatuses";
import {
  createActivityRecordsForClosedActivities,
  markActivityApplicationsClosed
} from "@/lib/userActivityRecords";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function logStatusError(error: unknown) {
  console.error("ECC activity status API error", {
    message: error instanceof Error ? error.message : "Unknown error",
    code:
      error instanceof SupabaseConfigError
        ? "ECC_SUPABASE_CONFIG_MISSING"
        : "ECC_ACTIVITY_STATUS_UNKNOWN"
  });
}

export async function GET() {
  try {
    return NextResponse.json(await getEccActivityStatuses());
  } catch (error) {
    logStatusError(error);

    return NextResponse.json(
      {
        error: "ECC activity status storage is temporarily unavailable.",
        debugCode:
          error instanceof SupabaseConfigError
            ? "ECC_SUPABASE_CONFIG_MISSING"
            : "ECC_ACTIVITY_STATUS_STORAGE_UNAVAILABLE"
      },
      { status: error instanceof SupabaseConfigError ? 503 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        {
          error: "Only ECC admins can open or close activity applications.",
          debugCode: "ECC_ACTIVITY_STATUS_FORBIDDEN"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const catalog = await getEccActivityCatalog({ includeArchived: true });
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
        const activityId = normalizeEccActivityId(key);

        if (activeIds.has(activityId) && typeof value === "boolean") {
          updates[activityId] = value;
        }
      });
    }

    if (body.paymentRequirements && typeof body.paymentRequirements === "object") {
      Object.entries(body.paymentRequirements).forEach(([key, value]) => {
        const activityId = normalizeEccActivityId(key);

        if (activeIds.has(activityId) && typeof value === "boolean") {
          paymentRequirements[activityId] = value;
        }
      });
    }

    const directIdRaw = cleanText(body.activity_id ?? body.activityId, 80);
    const activityId = directIdRaw ? normalizeEccActivityId(directIdRaw) : "";
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
          error: "No valid ECC activity status update was provided.",
          debugCode: "ECC_ACTIVITY_STATUS_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    const openedActivity = Object.keys(updates).find(
      (id) => updates[id] === true
    );

    if (openedActivity) {
      catalog
        .filter((item) => !item.archived)
        .forEach((item) => {
          updates[item.id] = item.id === openedActivity;
        });
    }

    const result = await updateEccActivityStatuses(
      updates,
      access.email,
      paymentRequirements
    );

    if (result.closedActivities.length > 0) {
      try {
        await markActivityApplicationsClosed("ecc", result.closedActivities);
        await createActivityRecordsForClosedActivities(
          "ecc",
          result.closedActivities
        );
      } catch (error) {
        console.error("ECC user activity close sync failed", error);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    logStatusError(error);

    return NextResponse.json(
      {
        error: "ECC activity status could not be saved.",
        debugCode:
          error instanceof SupabaseRequestError && error.status === 404
            ? "ECC_ACTIVITY_STATUS_TABLE_NOT_READY"
            : "ECC_ACTIVITY_STATUS_SAVE_FAILED"
      },
      { status: error instanceof SupabaseConfigError ? 503 : 500 }
    );
  }
}
