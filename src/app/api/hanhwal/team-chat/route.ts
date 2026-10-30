import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { getHanhwalMemberRegistrationByEmail } from "@/lib/hanhwalMemberRegistrations";
import { canOpenHanhwalTeamChat } from "@/lib/hanhwalJoin";
import { getHanhwalOperationalSettings } from "@/lib/hanhwalOperations";

export const dynamic = "force-dynamic";

function redirect(url: URL | string) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();
    if (!access.isLoggedIn) {
      return redirect(new URL("/login?callbackUrl=/hanhwal-join", request.url));
    }
    const registration = await getHanhwalMemberRegistrationByEmail(access.email);
    if (!canOpenHanhwalTeamChat(access, registration)) {
      return redirect(new URL("/hanhwal-join", request.url));
    }
    const settings = await getHanhwalOperationalSettings();
    return redirect(settings.officialTeamChatUrl);
  } catch (error) {
    console.error("Hanhwal team chat could not be opened", error);
    return redirect(new URL("/hanhwal-join", request.url));
  }
}
