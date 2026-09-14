import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import {
  cleanHanhwalOperationalSettings,
  getHanhwalOperationalSettings,
  saveHanhwalOperationalSettings
} from "@/lib/hanhwalOperations";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("Hanhwal operations API error", error);

  if (
    error instanceof SupabaseConfigError ||
    (error instanceof SupabaseRequestError && error.status === 404)
  ) {
    return NextResponse.json(
      { error: "Hanhwal operations storage is not ready." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { error: "Hanhwal operations could not be loaded or saved." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const access = await getCurrentHanhwalAccess();
    const settings = await getHanhwalOperationalSettings();

    return NextResponse.json({
      canManage: access.isAdmin && !isReadOnlyDeveloperEmail(access.email),
      settings: {
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
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin || !access.email || isReadOnlyDeveloperEmail(access.email)) {
      return NextResponse.json(
        { error: "Hanhwal administrator write access is required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const current = await getHanhwalOperationalSettings();
    const settings = cleanHanhwalOperationalSettings(
      {
        officialTeamChatUrl:
          typeof body.officialTeamChatUrl === "string"
            ? body.officialTeamChatUrl
            : current.officialTeamChatUrl,
        periodLabel:
          typeof body.periodLabel === "string" ? body.periodLabel : current.periodLabel
      },
      current
    );
    const saved = await saveHanhwalOperationalSettings(settings, access.email);

    return NextResponse.json({ settings: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
