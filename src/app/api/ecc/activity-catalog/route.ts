import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import {
  archiveEccActivityCatalogItem,
  createEccActivityCatalogItem,
  getEccActivityCatalog,
  updateEccActivityCatalogItem
} from "@/lib/eccOperations";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("ECC activity catalog API error", error);

  if (
    error instanceof SupabaseConfigError ||
    (error instanceof SupabaseRequestError && error.status === 404)
  ) {
    return NextResponse.json(
      { error: "ECC activity catalog storage is not ready." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "ECC activity catalog could not be saved." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();
    const activities = await getEccActivityCatalog({ includeArchived: access.isAdmin });

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
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "ECC administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const item = await createEccActivityCatalogItem(
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
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "ECC administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required." }, { status: 400 });
    }

    const item = await updateEccActivityCatalogItem(id, body, access.email);

    if (!item) {
      return NextResponse.json({ error: "ECC activity was not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json(
        { error: "ECC administrator access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";

    if (!id) {
      return NextResponse.json({ error: "Activity ID is required." }, { status: 400 });
    }

    const item = await archiveEccActivityCatalogItem(id, access.email);

    if (!item) {
      return NextResponse.json({ error: "ECC activity was not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
