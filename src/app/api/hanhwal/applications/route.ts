import { NextResponse } from "next/server";
import {
  defaultHanhwalActivityStatuses,
  hanhwalActivityTitles,
  emptyHanhwalActivityCounts,
  normalizeHanhwalActivityType,
  type HanhwalActivityType
} from "@/lib/hanhwalActivities";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { getHanhwalActivityStatuses } from "@/lib/hanhwalActivityStatuses";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type SupabaseApplicationRow = {
  id: string;
  activity_id: string;
  activity_title: string | null;
  name: string;
  gender: string;
  nationality: string;
  preferred_food: string;
  other_requests: string | null;
  status: string;
  created_at: string;
};

type HanhwalApplication = {
  id: string;
  type: HanhwalActivityType;
  activityTitle: string;
  name: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  otherRequests: string;
  status: string;
  createdAt: string;
};

const tableName = "hanhwal_activity_applications";
const selectedColumns =
  "id,created_at,activity_id,activity_title,name,gender,nationality,preferred_food,other_requests,status";

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

function toClientApplication(row: SupabaseApplicationRow): HanhwalApplication {
  const type = normalizeHanhwalActivityType(row.activity_id);

  return {
    id: row.id,
    type,
    activityTitle: row.activity_title ?? hanhwalActivityTitles[type],
    name: row.name,
    gender: row.gender,
    nationality: row.nationality,
    preferredFood: row.preferred_food,
    otherRequests: row.other_requests ?? "",
    status: row.status,
    createdAt: row.created_at
  };
}

function countApplications(rows: SupabaseApplicationRow[]) {
  const counts = emptyHanhwalActivityCounts();

  rows.forEach((row) => {
    counts[normalizeHanhwalActivityType(row.activity_id)] += 1;
  });

  return counts;
}

function isMissingActivityHistoryColumn(error: unknown) {
  return (
    error instanceof SupabaseRequestError &&
    error.status === 400 &&
    /column|schema cache|activity_instance_id|requires_payment|user_id/i.test(error.message)
  );
}

async function listApplications() {
  return supabaseRequest<SupabaseApplicationRow[]>(
    `${tableName}?select=${selectedColumns}&order=created_at.desc`
  );
}

async function buildApplicationsResponse(includeApplications: boolean) {
  const rows = await listApplications();

  return {
    counts: countApplications(rows),
    applications: includeApplications ? rows.map(toClientApplication) : []
  };
}

async function getAdminEmail() {
  const access = await getCurrentHanhwalAccess();

  return access.isAdmin ? access.email : "";
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    console.error("HANHWAL applications Supabase config error", {
      message: error.message,
      code: "HANHWAL_SUPABASE_CONFIG_MISSING",
      details: undefined,
      hint: undefined
    });

    return NextResponse.json(
      {
        error:
          "Supabase storage is not configured yet. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        debugCode: "HANHWAL_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const supabaseError = parseSupabaseError(error);
    console.error("HANHWAL applications Supabase error", {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });
  } else {
    console.error("HANHWAL applications API error", {
      message: error instanceof Error ? error.message : "Unknown error",
      code: "HANHWAL_APPLICATION_UNKNOWN_ERROR",
      details: undefined,
      hint: undefined
    });
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      {
        error: "Supabase application table is not ready yet.",
        debugCode: "HANHWAL_APPLICATION_TABLE_NOT_READY"
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "HANHWAL application storage is temporarily unavailable.",
      debugCode:
        error instanceof SupabaseRequestError
          ? "HANHWAL_SUPABASE_REQUEST_FAILED"
          : "HANHWAL_APPLICATION_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();

    return NextResponse.json(await buildApplicationsResponse(access.isAdmin));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isOfficialMember) {
      return NextResponse.json(
        {
          error: "HANHWAL official membership is required before applying for activities.",
          debugCode: "HANHWAL_APPLICATION_OFFICIAL_MEMBER_REQUIRED"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const type = normalizeHanhwalActivityType(
      cleanText(body.activity_id ?? body.activityId ?? body.type)
    );
    const activityTitle =
      cleanText(body.activity_title ?? body.activityTitle) || hanhwalActivityTitles[type];
    const name = cleanText(body.name ?? body.kakaoName);
    const gender = cleanText(body.gender);
    const nationality = cleanText(body.nationality);
    const preferredFood = cleanText(body.preferred_food ?? body.preferredFood);
    const otherRequests = cleanText(
      body.other_requests ?? body.otherRequests ?? body.request,
      1000
    );

    if (!name || !gender || !nationality || !preferredFood) {
      return NextResponse.json(
        {
          error: "Required application fields are missing.",
          debugCode: "HANHWAL_APPLICATION_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    let statuses = defaultHanhwalActivityStatuses();
    let activityInstanceId = "";
    let requiresPayment = true;

    try {
      const statusResult = await getHanhwalActivityStatuses();
      statuses = statusResult.statuses;
      activityInstanceId = statusResult.activityInstances[type];
      requiresPayment = statusResult.requiresPayment[type];
    } catch (error) {
      if (!(error instanceof SupabaseRequestError && error.status === 404)) {
        throw error;
      }
    }

    if (!statuses[type]) {
      return NextResponse.json(
        {
          error: "This HANHWAL activity application is currently closed.",
          debugCode: "HANHWAL_ACTIVITY_APPLICATION_CLOSED"
        },
        { status: 403 }
      );
    }

    const application = {
      activity_id: type,
      activity_title: activityTitle,
      name,
      gender,
      nationality,
      preferred_food: preferredFood,
      other_requests: otherRequests,
      status: "pending"
    };
    const trackedApplication = activityInstanceId
      ? {
          ...application,
          activity_instance_id: activityInstanceId,
          requires_payment: requiresPayment,
          user_id: access.email
        }
      : application;

    try {
      await supabaseRequest<SupabaseApplicationRow[]>(
        `${tableName}?select=${selectedColumns}`,
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(trackedApplication)
        }
      );
    } catch (error) {
      // The original Hanhwal application path remains available if the
      // additive activity-history migration has not reached production yet.
      if (!activityInstanceId || !isMissingActivityHistoryColumn(error)) {
        throw error;
      }

      await supabaseRequest<SupabaseApplicationRow[]>(
        `${tableName}?select=${selectedColumns}`,
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(application)
        }
      );
    }

    return NextResponse.json(await buildApplicationsResponse(access.isAdmin), {
      status: 201
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const email = await getAdminEmail();

    if (!email) {
      return NextResponse.json(
        {
          error: "Only HANHWAL admins can update application payment status.",
          debugCode: "HANHWAL_APPLICATION_PAYMENT_FORBIDDEN"
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { payments?: Record<string, boolean> };
    const payments = body.payments ?? {};
    const entries = Object.entries(payments)
      .map(([id, paid]) => [cleanText(id, 120), Boolean(paid)] as const)
      .filter(([id]) => Boolean(id));

    await Promise.all(
      entries.map(([id, paid]) =>
        supabaseRequest<SupabaseApplicationRow[]>(
          `${tableName}?id=eq.${encodeURIComponent(id)}&select=${selectedColumns}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              status: paid ? "paid" : "pending"
            })
          }
        )
      )
    );

    return NextResponse.json(await buildApplicationsResponse(true));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const email = await getAdminEmail();

    if (!email) {
      return NextResponse.json(
        {
          error: "Only HANHWAL admins can reset applicants.",
          debugCode: "HANHWAL_APPLICATION_RESET_FORBIDDEN"
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const type = normalizeHanhwalActivityType(url.searchParams.get("activity_id"));

    await supabaseRequest<null>(
      `${tableName}?activity_id=eq.${encodeURIComponent(type)}`,
      {
        method: "DELETE",
        headers: {
          Prefer: "return=minimal"
        }
      }
    );

    return NextResponse.json(await buildApplicationsResponse(true));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
