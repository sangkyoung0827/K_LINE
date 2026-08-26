import "server-only";

import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { SupabaseConfigError, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";
import type { JejuAccess, JejuRole } from "@/lib/jeju/types";

type JejuRoleRow = {
  email: string;
  role: "user" | "supporter" | "jeju_admin";
  status: "active" | "revoked";
};

function emptyAccess(email = "", isLoggedIn = false): JejuAccess {
  return {
    email,
    role: "user",
    isAdmin: false,
    isLoggedIn,
    isSupporter: false,
    isSuperAdmin: false
  };
}

function toAccess(email: string, role: JejuRole): JejuAccess {
  return {
    email,
    role,
    isAdmin: role === "jeju_admin" || role === "super_admin",
    isLoggedIn: true,
    isSupporter: role === "supporter" || role === "jeju_admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin"
  };
}

export async function getJejuAccessForEmail(email?: string | null): Promise<JejuAccess> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return emptyAccess();
  }

  const globalAccess = await getAdminAccess(normalizedEmail);

  if (globalAccess.isSuperAdmin) {
    return toAccess(normalizedEmail, "super_admin");
  }

  try {
    const rows = await supabaseRequest<JejuRoleRow[]>(
      `jeju_roles?select=email,role,status&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`
    );
    const row = rows[0];

    if (row?.status === "active" && (row.role === "supporter" || row.role === "jeju_admin")) {
      return toAccess(normalizedEmail, row.role);
    }
  } catch (error) {
    if (!(error instanceof SupabaseConfigError || error instanceof SupabaseRequestError)) {
      console.error("Jeju Explorer role lookup failed", error);
    }
  }

  return toAccess(normalizedEmail, "user");
}
