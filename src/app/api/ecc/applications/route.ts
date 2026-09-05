import { NextResponse } from "next/server";
import { normalizeEccActivityId } from "@/lib/eccActivities";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getEccActivityStatuses } from "@/lib/eccActivityStatuses";
import { getEccActivityCatalog } from "@/lib/eccOperations";
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

type EccApplication = {
  id: string;
  type: string;
  activityTitle: string;
  name: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  otherRequests: string;
  status: string;
  createdAt: string;
};

const tableName = "ecc_activity_applications";
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

function toClientApplication(row: SupabaseApplicationRow): EccApplication {
  const type = normalizeEccActivityId(row.activity_id);

  return {
    id: row.id,
    type,
    activityTitle: row.activity_title?.trim() || type,
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
  const counts: Record<string, number> = {};

  rows.forEach((row) => {
    const activityId = normalizeEccActivityId(row.activity_id);
    counts[activityId] = (counts[activityId] ?? 0) + 1;
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
  const access = await getCurrentEccAccess();
  return access.isAdmin ? access.email : "";
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error:
          "Supabase storage is not configured yet. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        debugCode: "ECC_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const supabaseError = parseSupabaseError(error);
    console.error("ECC applications Supabase error", supabaseError);
  } else {
    console.error("ECC applications API error", error);
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      {
        error: "Supabase application table is not ready yet.",
        debugCode: "ECC_APPLICATION_TABLE_NOT_READY"
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "ECC application storage is temporarily unavailable.",
      debugCode:
        error instanceof SupabaseRequestError
          ? "ECC_SUPABASE_REQUEST_FAILED"
          : "ECC_APPLICATION_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();
    return NextResponse.json(await buildApplicationsResponse(access.isAdmin));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isOfficialMember) {
      return NextResponse.json(
        {
          error: "ECC official membership is required before applying for activities.",
          debugCode: "ECC_APPLICATION_OFFICIAL_MEMBER_REQUIRED"
        },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const activityId = normalizeEccActivityId(
      cleanText(body.activity_id ?? body.activityId ?? body.type, 80)
    );
    const catalog = await getEccActivityCatalog();
    const catalogItem = catalog.find((item) => item.id === activityId);

    if (!catalogItem) {
      return NextResponse.json(
        {
          error: "This ECC activity is no longer available.",
          debugCode: "ECC_ACTIVITY_NOT_AVAILABLE"
        },
        { status: 400 }
      );
    }

    const requestedTitle = cleanText(body.activity_title ?? body.activityTitle, 160);
    const activityTitle =
      requestedTitle === catalogItem.titleKo || requestedTitle === catalogItem.titleEn
        ? requestedTitle
        : catalogItem.titleEn;
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
          debugCode: "ECC_APPLICATION_VALIDATION_FAILED"
        },
        { status: 400 }
      );
    }

    let activityInstanceId = "";
    let requiresPayment = true;

    try {
      const statusResult = await getEccActivityStatuses();

      if (!statusResult.statuses[activityId]) {
        return NextResponse.json(
          {
            error: "This ECC activity application is currently closed.",
            debugCode: "ECC_ACTIVITY_APPLICATION_CLOSED"
          },
          { status: 403 }
        );
      }

      activityInstanceId = statusResult.activityInstances[activityId] ?? "";
      requiresPayment = statusResult.requiresPayment[activityId] !== false;
    } catch (error) {
      if (!(error instanceof SupabaseRequestError && error.status === 404)) {
        throw error;
      }
    }

    const application = {
      activity_id: activityId,
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
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(trackedApplication)
        }
      );
    } catch (error) {
      if (!activityInstanceId || !isMissingActivityHistoryColumn(error)) {
        throw error;
      }

      await supabaseRequest<SupabaseApplicationRow[]>(
        `${tableName}?select=${selectedColumns}`,
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
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
          error: "Only ECC admins can update application payment status.",
          debugCode: "ECC_APPLICATION_PAYMENT_FORBIDDEN"
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
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ status: paid ? "paid" : "pending" })
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
          error: "Only ECC admins can reset applicants.",
          debugCode: "ECC_APPLICATION_RESET_FORBIDDEN"
        },
        { status: 403 }
      );
    }

    const activityId = normalizeEccActivityId(
      new URL(request.url).searchParams.get("activity_id")
    );

    await supabaseRequest<null>(
      `${tableName}?activity_id=eq.${encodeURIComponent(activityId)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      }
    );

    return NextResponse.json(await buildApplicationsResponse(true));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
