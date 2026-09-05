import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import {
  cleanEccOperationalSettings,
  getEccOperationalSettings,
  saveEccOperationalSettings
} from "@/lib/eccOperations";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("ECC operations API error", error);

  if (
    error instanceof SupabaseConfigError ||
    (error instanceof SupabaseRequestError && error.status === 404)
  ) {
    return NextResponse.json(
      { error: "ECC operations storage is not ready." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: "ECC operations could not be loaded or saved." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();
    const settings = await getEccOperationalSettings();

    return NextResponse.json({
      canManage: access.isAdmin,
      settings: {
        inquiryChatUrl: settings.inquiryChatUrl,
        newMemberOpenChatUrl: settings.newMemberOpenChatUrl,
        officialTeamChatUrl: access.isOfficialMember ? settings.officialTeamChatUrl : "",
        periodLabel: settings.periodLabel,
        updatedAt: settings.updatedAt
      }
    });
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
    const settings = cleanEccOperationalSettings(body);
    const saved = await saveEccOperationalSettings(settings, access.email);

    return NextResponse.json({ settings: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
