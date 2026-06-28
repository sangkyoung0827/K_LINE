import { NextResponse } from "next/server";
import {
  createAlumniNotice,
  deleteAlumniNotice,
  listAllAlumniNotices,
  listReadableAlumniNotices,
  patchAlumniNotice
} from "@/lib/eccAlumni";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { cleanText, SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("ECC alumni notices API error", error);
  return NextResponse.json(
    {
      error:
        error instanceof SupabaseConfigError || error instanceof SupabaseRequestError
          ? "ECC Alumni notice storage is not ready."
          : "ECC Alumni notices are temporarily unavailable."
    },
    { status: error instanceof SupabaseConfigError ? 503 : 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();
    const notices = access.isAdmin ? await listAllAlumniNotices() : await listReadableAlumniNotices();

    return NextResponse.json({ notices });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const notice = await createAlumniNotice({
      content: body.content,
      createdBy: access.email,
      isPinned: body.is_pinned ?? body.isPinned,
      title: body.title,
      visibility: body.visibility
    });

    return NextResponse.json({ notice, notices: await listAllAlumniNotices() }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin || !access.email) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const id = cleanText(body.id, 120);

    if (!id) {
      return NextResponse.json({ error: "Notice id is required." }, { status: 400 });
    }

    const notice = await patchAlumniNotice({
      content: body.content,
      id,
      isPinned: body.is_pinned ?? body.isPinned,
      title: body.title,
      visibility: body.visibility
    });

    return NextResponse.json({ notice, notices: await listAllAlumniNotices() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const id = cleanText(new URL(request.url).searchParams.get("id"), 120);

    if (!id) {
      return NextResponse.json({ error: "Notice id is required." }, { status: 400 });
    }

    await deleteAlumniNotice(id);

    return NextResponse.json({ notices: await listAllAlumniNotices() });
  } catch (error) {
    return errorResponse(error);
  }
}
