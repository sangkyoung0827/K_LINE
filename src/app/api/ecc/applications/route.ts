import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

type ApplicationType = "gathering" | "mt" | "special";

type SupabaseApplicationRow = {
  id: string;
  type: ApplicationType;
  kakao_name: string;
  gender: string;
  nationality: string;
  preferred_food: string;
  request: string | null;
  created_at: string;
};

type EccApplication = {
  id: string;
  type: ApplicationType;
  kakaoName: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  request: string;
  createdAt: string;
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const validApplicationTypes: ApplicationType[] = ["gathering", "mt", "special"];
const validApplicationTypeSet = new Set<ApplicationType>(validApplicationTypes);
const tableName = "ecc_activity_applications";
const selectedColumns =
  "id,type,kakao_name,gender,nationality,preferred_food,request,created_at";

class SupabaseConfigError extends Error {}

class SupabaseRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new SupabaseConfigError("Supabase environment variables are missing.");
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceRoleKey
  };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("Authorization", `Bearer ${config.serviceRoleKey}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new SupabaseRequestError(await response.text(), response.status);
  }

  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : null) as T;
}

function toClientApplication(row: SupabaseApplicationRow): EccApplication {
  return {
    id: row.id,
    type: row.type,
    kakaoName: row.kakao_name,
    gender: row.gender,
    nationality: row.nationality,
    preferredFood: row.preferred_food,
    request: row.request ?? "",
    createdAt: row.created_at
  };
}

function emptyCounts(): Record<ApplicationType, number> {
  return {
    gathering: 0,
    mt: 0,
    special: 0
  };
}

function countApplications(rows: SupabaseApplicationRow[]) {
  const counts = emptyCounts();

  rows.forEach((row) => {
    if (validApplicationTypeSet.has(row.type)) {
      counts[row.type] += 1;
    }
  });

  return counts;
}

function cleanText(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
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

function apiErrorResponse(error: unknown) {
  console.error("ECC applications API error", error);

  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error:
          "Supabase storage is not configured yet. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json(
      {
        error:
          "Supabase application table is not ready yet. Please create ecc_activity_applications."
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "ECC application storage is temporarily unavailable."
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const session = await auth();
    const email = session?.user?.email ?? "";

    return NextResponse.json(await buildApplicationsResponse(isSuperAdminEmail(email)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const type = cleanText(body.type) as ApplicationType;
    const kakaoName = cleanText(body.kakaoName);
    const gender = cleanText(body.gender);
    const nationality = cleanText(body.nationality);
    const preferredFood = cleanText(body.preferredFood);
    const otherRequest = cleanText(body.request, 1000);

    if (!validApplicationTypeSet.has(type)) {
      return NextResponse.json({ error: "Invalid application type." }, { status: 400 });
    }

    if (!kakaoName || !gender || !nationality || !preferredFood) {
      return NextResponse.json({ error: "Required application fields are missing." }, { status: 400 });
    }

    await supabaseRequest<SupabaseApplicationRow[]>(`${tableName}?select=${selectedColumns}`, {
      method: "POST",
      body: JSON.stringify({
        type,
        kakao_name: kakaoName,
        gender,
        nationality,
        preferred_food: preferredFood,
        request: otherRequest
      })
    });

    const session = await auth();
    const email = session?.user?.email ?? "";

    return NextResponse.json(await buildApplicationsResponse(isSuperAdminEmail(email)));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
