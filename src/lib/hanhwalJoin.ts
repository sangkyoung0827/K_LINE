import "server-only";

import type { HanhwalAccess } from "@/lib/hanhwalAccess";
import type { HanhwalMemberRegistration } from "@/lib/hanhwalMemberRegistrations";

export const hanhwalTeamChatPath = "/api/hanhwal/team-chat";

export function canOpenHanhwalTeamChat(
  access: Pick<HanhwalAccess, "email" | "isLoggedIn" | "isOfficialMember">,
  registration: Pick<HanhwalMemberRegistration, "googleEmail" | "status"> | null
) {
  if (!access.isLoggedIn || !access.email) return false;
  if (access.isOfficialMember) return true;
  return Boolean(registration && registration.status !== "rejected" &&
    registration.googleEmail.toLowerCase() === access.email.toLowerCase());
}
