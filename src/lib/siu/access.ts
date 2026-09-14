import "server-only";
import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { supabaseRequest } from "@/lib/supabaseServer";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { SiuError, siuRoles, type SiuAccess, type SiuRole } from "./model";

export async function getCurrentSiuAccess(): Promise<SiuAccess> {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  let role: SiuRole = "user";
  let globalRank = 1;
  if (email) {
    const global = await getAdminAccess(email);
    globalRank = global.isDeveloper ? 5 : global.isSuperAdmin ? 4 : 1;
    if (globalRank > 1) role = siuRoles[globalRank - 1];
    else {
      const rows = await supabaseRequest<{ role: SiuRole }[]>(`siu_roles?select=role&email=eq.${encodeURIComponent(email)}&limit=1`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (rows[0] && siuRoles.includes(rows[0].role)) role = rows[0].role;
    }
  }
  const rank = siuRoles.indexOf(role) + 1;
  return {
    email, authenticated: Boolean(email), displayName: session?.user?.name?.includes("@") ? "K_LINE user" : session?.user?.name?.trim().slice(0, 100) || "K_LINE user",
    role, globalRank, isOfficialMember: rank >= 2, isAdmin: rank >= 3, isSuperAdmin: rank >= 4,
    isDeveloper: rank === 5, isReadOnly: isReadOnlyDeveloperEmail(email)
  };
}
export function requireSiuWrite(access: SiuAccess) {
  if (!access.authenticated) throw new SiuError("LOGIN_REQUIRED", 401);
  if (access.isReadOnly) throw new SiuError("READ_ONLY_DEVELOPER", 403);
}
