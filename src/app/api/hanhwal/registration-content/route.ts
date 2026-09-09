import { NextResponse } from "next/server";
import { defaultHanhwalRegistrationContent } from "@/data/hanhwalRegistrationContent";
import {
  cleanHanhwalRegistrationContent,
  getHanhwalRegistrationContent,
  saveHanhwalRegistrationContent
} from "@/lib/hanhwalRegistrationContent";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function storageError(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "HANHWAL registration content storage is not configured." }, { status: 503 });
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json({ error: "HANHWAL registration content storage is not ready." }, { status: 503 });
  }

  console.error("HANHWAL registration content API error", error);
  return NextResponse.json({ error: "HANHWAL registration content storage is temporarily unavailable." }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ content: await getHanhwalRegistrationContent(), storageReady: true });
  } catch (error) {
    if (error instanceof SupabaseConfigError || (error instanceof SupabaseRequestError && error.status === 404)) {
      return NextResponse.json({ content: defaultHanhwalRegistrationContent, storageReady: false });
    }

    return storageError(error);
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

    const content = cleanHanhwalRegistrationContent((await request.json()) as Record<string, unknown>);

    if (!content.title || !content.body) {
      return NextResponse.json({ error: "A title and body are required." }, { status: 400 });
    }

    const saved = await saveHanhwalRegistrationContent({ ...content, updatedBy: access.email });

    if (!saved) {
      return NextResponse.json({ error: "HANHWAL registration content could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ content: saved });
  } catch (error) {
    return storageError(error);
  }
}
