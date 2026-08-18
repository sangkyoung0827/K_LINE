import { NextResponse } from "next/server";
import {
  defaultHanhwalActivityStatuses,
  hanhwalActivityTypes,
  hanhwalActivityTypeSet,
  normalizeHanhwalActivityType,
  type HanhwalActivityType
} from "@/lib/hanhwalActivities";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { getHanhwalActivityStatuses, updateHanhwalActivityStatuses } from "@/lib/hanhwalActivityStatuses";
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
    console.error("HANHWAL activity status Supabase error", {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });
    return;
  }

  console.error("HANHWAL activity status API error", {
    message: error instanceof Error ? error.message : "Unknown error",
    code: error instanceof SupabaseConfigError ? "HANHWAL_SUPABASE_CONFIG_MISSING" : "HANHWAL_ACTIVITY_STATUS_UNKNOWN",
    details: undefined,
    hint: undefined
  });
}

export async function GET() {
  try {
    return NextResponse.json(await getHanhwalActivityStatuses());
  } catch (error) {
    logStatusError(error);

    if (error instanceof SupabaseRequestError && error.status === 404) {
      return NextResponse.json({
        statuses: defaultHanhwalActivityStatuses(),
        tableReady: false,
        debugCode: "HANHWAL_ACTIVITY_STATUS_TABLE_NOT_READY"
      });
    }

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
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      activity_id?: unknown;
      activityId?: unknown;
      is_open?: unknown;
      isOpen?: unknown;
      statuses?: Partial<Record<HanhwalActivityType, boolean>>;
    };
    const updates: Partial<Record<HanhwalActivityType, boolean>> = {};

    if (body.statuses && typeof body.statuses === "object") {
      Object.entries(body.statuses).forEach(([key, value]) => {
        const type = normalizeHanhwalActivityType(key);

        if (hanhwalActivityTypeSet.has(type) && typeof value === "boolean") {
          updates[type] = value;
        }
      });
    }

    const activityId = cleanText(body.activity_id ?? body.activityId);
    const directValue = body.is_open ?? body.isOpen;

    if (activityId && typeof directValue === "boolean") {
      updates[normalizeHanhwalActivityType(activityId)] = directValue;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: "No valid HANHWAL activity status update was provided.",
          debugCode: "HANHWAL_ACTIVITY_STATUS_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    // Only one HANHWAL activity can accept applications at a time. Opening a new
    // activity therefore closes every other activity in the same update.
    const openedActivity = hanhwalActivityTypes.find((type) => updates[type] === true);

    if (openedActivity) {
      hanhwalActivityTypes.forEach((type) => {
        updates[type] = type === openedActivity;
      });
    }

    return NextResponse.json(await updateHanhwalActivityStatuses(updates, access.email));
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
