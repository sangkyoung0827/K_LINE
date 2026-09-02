import { NextResponse } from "next/server";
import { defaultEccRegistrationContent } from "@/data/eccRegistrationContent";
import {
  cleanEccRegistrationContent,
  getEccRegistrationContent,
  saveEccRegistrationContent
} from "@/lib/eccRegistrationContent";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function storageError(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "ECC registration content storage is not configured." }, { status: 503 });
  }

  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json({ error: "ECC registration content storage is not ready." }, { status: 503 });
  }

  console.error("ECC registration content API error", error);
  return NextResponse.json({ error: "ECC registration content storage is temporarily unavailable." }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({ content: await getEccRegistrationContent(), storageReady: true });
  } catch (error) {
    if (error instanceof SupabaseConfigError || (error instanceof SupabaseRequestError && error.status === 404)) {
      return NextResponse.json({ content: defaultEccRegistrationContent, storageReady: false });
    }

    return storageError(error);
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

    const content = cleanEccRegistrationContent((await request.json()) as Record<string, unknown>);

    if (!content.title || !content.body) {
      return NextResponse.json({ error: "A title and body are required." }, { status: 400 });
    }

    const saved = await saveEccRegistrationContent({ ...content, updatedBy: access.email });

    if (!saved) {
      return NextResponse.json({ error: "ECC registration content could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ content: saved });
  } catch (error) {
    return storageError(error);
  }
}
