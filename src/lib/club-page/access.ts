import "server-only";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import type { ClubKey } from "@/types/club-page";
import { ClubPageError } from "./validation";

export function getClubWebsiteAccess(club: ClubKey) {
  return club === "ecc" ? getCurrentEccAccess() : getCurrentHanhwalAccess();
}
export async function requireClubEditor(club: ClubKey) {
  const access = await getClubWebsiteAccess(club);
  if (!access.isLoggedIn) throw new ClubPageError("로그인이 필요합니다.", 401);
  if (!access.isAdmin) throw new ClubPageError("해당 동아리 관리자 권한이 필요합니다.", 403);
  return access;
}
