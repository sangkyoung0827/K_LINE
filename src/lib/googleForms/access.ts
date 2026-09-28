import "server-only";

import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { getEccAccessForEmail } from "@/lib/eccAccess";
import { getJejuAccessForEmail } from "@/lib/jeju/access";
import { getCurrentSiuAccess } from "@/lib/siu/access";
import type { GoogleFormClubKey } from "./types";

export type GoogleFormsAccess = {
  email: string;
  authenticated: boolean;
  canConnect: boolean;
  isReadOnly: boolean;
  manageableClubs: GoogleFormClubKey[];
};

export async function getGoogleFormsAccess(): Promise<GoogleFormsAccess> {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email) return { email: "", authenticated: false, canConnect: false, isReadOnly: false, manageableClubs: [] };

  const global = await getAdminAccess(email);
  if (global.isSuperAdmin) {
    return {
      email,
      authenticated: true,
      canConnect: !global.isReadOnly,
      isReadOnly: Boolean(global.isReadOnly),
      manageableClubs: ["ecc", "social_impact_union", "jeju", "general"]
    };
  }

  const [ecc, siu, jeju] = await Promise.all([
    getEccAccessForEmail(email).catch(() => null),
    getCurrentSiuAccess().catch(() => null),
    getJejuAccessForEmail(email).catch(() => null)
  ]);
  const manageableClubs: GoogleFormClubKey[] = [];
  if (ecc?.isAdmin) manageableClubs.push("ecc");
  if (siu?.isAdmin) manageableClubs.push("social_impact_union");
  if (jeju?.isAdmin) manageableClubs.push("jeju");

  return { email, authenticated: true, canConnect: false, isReadOnly: false, manageableClubs };
}

export function assertClubAccess(access: GoogleFormsAccess, clubKey: GoogleFormClubKey, write = false) {
  if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
  if (!access.manageableClubs.includes(clubKey)) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
  if (write && access.isReadOnly) throw new GoogleFormsAuthorizationError("READ_ONLY", 403);
}

export class GoogleFormsAuthorizationError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
