import { NextResponse } from "next/server";
import {
  defaultEccActivityStatuses,
  eccActivityTypes,
  eccActivityTypeSet,
  normalizeEccActivityType,
  type EccActivityType
} from "@/lib/eccActivities";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getEccActivityStatuses, updateEccActivityStatuses } from "@/lib/eccActivityStatuses";
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

function parseSupabaseError(error: SupabaseRequestError) {
  try {
    const parsed = JSON.parse(error.message) as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    return {
      message: parsed.message ?? error.message,
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint
    };
  } catch {
    return {
      message: error.message,
      code: undefined,
      details: undefined,
      hint: undefined
    };
  }
}

function logStatusError(error: unknown) {
  if (error instanceof SupabaseRequestError) {
    const supabaseError = parseSupabaseError(error);
    console.error("ECC activity status Supabase error", {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });
    return;
  }

  console.error("ECC activity status API error", {
    message: error instanceof Error ? error.message : "Unknown error",
    code: error instanceof SupabaseConfigError ? "ECC_SUPABASE_CONFIG_MISSING" : "ECC_ACTIVITY_STATUS_UNKNOWN",
    details: undefined,
    hint: undefined
  });
}

export async function GET() {
  try {
    return NextResponse.json(await getEccActivityStatuses());
  } catch (error) {
    logStatusError(error);

    if (error instanceof SupabaseRequestError && error.status === 404) {
      return NextResponse.json({
        statuses: defaultEccActivityStatuses(),
        tableReady: false,
        debugCode: "ECC_ACTIVITY_STATUS_TABLE_NOT_READY"
      });
    }

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
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      activity_id?: unknown;
      activityId?: unknown;
      is_open?: unknown;
      isOpen?: unknown;
      requires_payment?: unknown;
      requiresPayment?: unknown;
      statuses?: Partial<Record<EccActivityType, boolean>>;
      paymentRequirements?: Partial<Record<EccActivityType, boolean>>;
    };
    const updates: Partial<Record<EccActivityType, boolean>> = {};
    const paymentRequirements: Partial<Record<EccActivityType, boolean>> = {};

    if (body.statuses && typeof body.statuses === "object") {
      Object.entries(body.statuses).forEach(([key, value]) => {
        const type = normalizeEccActivityType(key);

        if (eccActivityTypeSet.has(type) && typeof value === "boolean") {
          updates[type] = value;
        }
      });
    }

    if (body.paymentRequirements && typeof body.paymentRequirements === "object") {
      Object.entries(body.paymentRequirements).forEach(([key, value]) => {
        const type = normalizeEccActivityType(key);

        if (eccActivityTypeSet.has(type) && typeof value === "boolean") {
          paymentRequirements[type] = value;
        }
      });
    }

    const activityId = cleanText(body.activity_id ?? body.activityId);
    const directValue = body.is_open ?? body.isOpen;

    if (activityId && typeof directValue === "boolean") {
      updates[normalizeEccActivityType(activityId)] = directValue;
    }

    const directPaymentValue = body.requires_payment ?? body.requiresPayment;

    if (activityId && typeof directPaymentValue === "boolean") {
      paymentRequirements[normalizeEccActivityType(activityId)] = directPaymentValue;
    }

    if (Object.keys(updates).length === 0 && Object.keys(paymentRequirements).length === 0) {
      return NextResponse.json(
        {
          error: "No valid ECC activity status update was provided.",
          debugCode: "ECC_ACTIVITY_STATUS_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Only one ECC activity can accept applications at a time. Opening a new
    // activity therefore closes every other activity in the same update.
    const openedActivity = eccActivityTypes.find((type) => updates[type] === true);

    if (openedActivity) {
      eccActivityTypes.forEach((type) => {
        updates[type] = type === openedActivity;
      });
    }

    const result = await updateEccActivityStatuses(updates, access.email, paymentRequirements);

    if (result.closedActivities.length > 0) {
      // This is a secondary Passport-data write. A failure must never undo a
      // successful admin close action in the established ECC workflow.
      try {
        await markActivityApplicationsClosed("ecc", result.closedActivities);
        await createActivityRecordsForClosedActivities("ecc", result.closedActivities);
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
