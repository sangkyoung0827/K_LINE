import "server-only";
import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { getEccAccessForEmail } from "@/lib/eccAccess";
import { getHanhwalAccessForEmail } from "@/lib/hanhwalAccess";
import { isGoogleFormsAdminProduction } from "@/lib/googleForms/safety";
import { supabaseRequest } from "@/lib/supabaseServer";
import { studioClubs, StudioError, type StudioClub } from "./model";

export type StudioAccess = { email: string; manageableClubs: StudioClub[]; readOnly: boolean; canSetLimits: boolean };
// App calls pass only the identity obtained from getActor, never a client-supplied email/role.
export async function getStudioAccess(verifiedEmail?: string, verifiedReadOnly = false): Promise<StudioAccess> {
  const email = normalizeEmail(verifiedEmail ?? (await auth())?.user?.email);
  if (!email) throw new StudioError("LOGIN_REQUIRED", 401);
  const global = await getAdminAccess(email);
  const readOnly = verifiedReadOnly || Boolean(global.isReadOnly);
  if (isGoogleFormsAdminProduction()) {
    const ecc = global.isSuperAdmin || (await getEccAccessForEmail(email)).isAdmin;
    return { email, manageableClubs: ecc ? ["ecc"] : [], readOnly, canSetLimits: global.isSuperAdmin && !readOnly };
  }
  if (global.isSuperAdmin) return { email, manageableClubs: [...studioClubs], readOnly, canSetLimits: !readOnly };
  const manageableClubs: StudioClub[] = [];
  if ((await getEccAccessForEmail(email)).isAdmin) manageableClubs.push("ecc");
  if ((await getHanhwalAccessForEmail(email)).isAdmin) manageableClubs.push("hanhwal");
  const rows = await supabaseRequest<{ role: string }[]>(`siu_roles?select=role&email=eq.${encodeURIComponent(email)}&limit=1`, { cache: "no-store" });
  if (["admin", "super_admin", "developer"].includes(rows[0]?.role || "")) manageableClubs.push("social_impact_union");
  return { email, manageableClubs, readOnly, canSetLimits: false };
}
export function assertStudioAccess(access: StudioAccess, club: StudioClub, write = true) {
  if (!access.email) throw new StudioError("LOGIN_REQUIRED", 401);
  if (!access.manageableClubs.includes(club)) throw new StudioError("CLUB_ADMIN_REQUIRED", 403);
  if (write && access.readOnly) throw new StudioError("READ_ONLY_ACCOUNT", 403);
}
