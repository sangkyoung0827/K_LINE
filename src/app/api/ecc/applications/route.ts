import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasSuperAdminAccess } from "@/lib/admin";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ApplicationType = "gathering" | "mt" | "special" | "opening" | "farewell";

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
  type: ApplicationType;
  activityTitle: string;
  name: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  otherRequests: string;
  status: string;
  createdAt: string;
};

const validApplicationTypes: ApplicationType[] = [
  "gathering",
  "mt",
  "special",
  "opening",
  "farewell"
];
const validApplicationTypeSet = new Set<ApplicationType>(validApplicationTypes);
const activityTitles: Record<ApplicationType, string> = {
  gathering: "International Gathering",
  mt: "MT",
  special: "Special Event",
  opening: "Semester Opening Party",
  farewell: "Farewell Party"
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

function normalizeApplicationType(value: string | null | undefined): ApplicationType {
  const normalized = value?.trim().toLowerCase();
  return validApplicationTypeSet.has(normalized as ApplicationType)
    ? (normalized as ApplicationType)
    : "gathering";
}

function toClientApplication(row: SupabaseApplicationRow): EccApplication {
  const type = normalizeApplicationType(row.activity_id);

  return {
    id: row.id,
    type,
    activityTitle: row.activity_title ?? activityTitles[type],
    name: row.name,
    gender: row.gender,
    nationality: row.nationality,
    preferredFood: row.preferred_food,
    otherRequests: row.other_requests ?? "",
    status: row.status,
    createdAt: row.created_at
  };
}

function emptyCounts(): Record<ApplicationType, number> {
  return {
    gathering: 0,
    mt: 0,
    special: 0,
    opening: 0,
    farewell: 0
  };
}

function countApplications(rows: SupabaseApplicationRow[]) {
  const counts = emptyCounts();

  rows.forEach((row) => {
    counts[normalizeApplicationType(row.activity_id)] += 1;
  });

  return counts;
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

async function getSuperAdminEmail() {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (await hasSuperAdminAccess(email)) ? email : "";
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    console.error("ECC applications Supabase config error", {
      message: error.message,
      code: "ECC_SUPABASE_CONFIG_MISSING",
      details: undefined,
      hint: undefined
    });

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
    console.error("ECC applications Supabase error", {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });
  } else {
    console.error("ECC applications API error", {
      message: error instanceof Error ? error.message : "Unknown error",
      code: "ECC_APPLICATION_UNKNOWN_ERROR",
      details: undefined,
      hint: undefined
    });
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
    const session = await auth();
    const email = session?.user?.email ?? "";

    return NextResponse.json(await buildApplicationsResponse(await hasSuperAdminAccess(email)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = normalizeApplicationType(
      cleanText(body.activity_id ?? body.activityId ?? body.type)
    );
    const activityTitle =
      cleanText(body.activity_title ?? body.activityTitle) || activityTitles[type];
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

    await supabaseRequest<SupabaseApplicationRow[]>(
      `${tableName}?select=${selectedColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          activity_id: type,
          activity_title: activityTitle,
          name,
          gender,
          nationality,
          preferred_food: preferredFood,
          other_requests: otherRequests,
          status: "pending"
        })
      }
    );

    const session = await auth();
    const email = session?.user?.email ?? "";

    return NextResponse.json(await buildApplicationsResponse(await hasSuperAdminAccess(email)), {
      status: 201
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const email = await getSuperAdminEmail();

    if (!email) {
      return NextResponse.json(
        {
          error: "Only the super admin can update application payment status.",
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
    const email = await getSuperAdminEmail();

    if (!email) {
      return NextResponse.json(
        {
          error: "Only the super admin can reset applicants.",
          debugCode: "ECC_APPLICATION_RESET_FORBIDDEN"
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const type = normalizeApplicationType(url.searchParams.get("activity_id"));

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
