import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { updateHanhwalActivityStatuses } from "@/lib/hanhwalActivityStatuses";
import {
  createActivityRecordsForClosedActivities,
  markActivityApplicationsClosed
} from "@/lib/userActivityRecords";
import {
  archiveHanhwalActivityCatalogItem,
  createHanhwalActivityCatalogItem,
  getHanhwalActivityCatalog,
  updateHanhwalActivityCatalogItem
} from "@/lib/hanhwalOperations";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("HANHWAL activity catalog API error", error);

  if (
    error instanceof SupabaseConfigError ||
    (error instanceof SupabaseRequestError && error.status === 404)
  ) {
    return NextResponse.json(
      { error: "HANHWAL activity catalog storage is not ready." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "HANHWAL activity catalog could not be saved." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();
    const activities = await getHanhwalActivityCatalog({ includeArchived: access.isAdmin });

    return NextResponse.json({
      activities,
      canManage: access.isAdmin
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "HANHWAL administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const item = await createHanhwalActivityCatalogItem(
      (await request.json()) as Record<string, unknown>,
      access.email
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "HANHWAL administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required." }, { status: 400 });
    }

    const item = await updateHanhwalActivityCatalogItem(id, body, access.email);

    if (!item) {
      return NextResponse.json({ error: "HANHWAL activity was not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "HANHWAL administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required." }, { status: 400 });
    }

    const statusResult = await updateHanhwalActivityStatuses(
      { [id]: false },
      access.email
    );

    if (statusResult.closedActivities.length > 0) {
      try {
        await markActivityApplicationsClosed("hanhwal", statusResult.closedActivities);
        await createActivityRecordsForClosedActivities(
          "hanhwal",
          statusResult.closedActivities
        );
      } catch (error) {
        console.error("HANHWAL activity archive history sync failed", error);
      }
    }

    const item = await archiveHanhwalActivityCatalogItem(id, access.email);

    if (!item) {
      return NextResponse.json({ error: "HANHWAL activity was not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
