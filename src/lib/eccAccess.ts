import "server-only";

import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import {
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export type EccRole = "user" | "official_member" | "admin" | "super_admin" | "developer";

export type EccAccess = {
  email: string;
  isAdmin: boolean;
  isDeveloper: boolean;
  isLoggedIn: boolean;
  isOfficialMember: boolean;
  isSuperAdmin: boolean;
  role: EccRole;
};

export type EccRoleRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_official_member: boolean | null;
  payment_confirmed: boolean | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  official_member_status: string | null;
  admin_status: string | null;
  admin_requested_at: string | null;
  admin_approved_by: string | null;
  admin_approved_at: string | null;
  super_admin_status: string | null;
  super_admin_requested_at: string | null;
  super_admin_approved_by: string | null;
  super_admin_approved_at: string | null;
};

export const eccRolesTable = "ecc_roles";
export const eccRoleColumns =
  "id,created_at,updated_at,email,name,avatar_url,role,is_official_member,payment_confirmed,payment_confirmed_by,payment_confirmed_at,official_member_status,admin_status,admin_requested_at,admin_approved_by,admin_approved_at,super_admin_status,super_admin_requested_at,super_admin_approved_by,super_admin_approved_at";

export const defaultEccOfficialTeamChatUrl = "https://invite.kakao.com/tc/RQerLbSgvH";

const roleRank: Record<EccRole, number> = {
  user: 1,
  official_member: 2,
  admin: 3,
  super_admin: 4,
  developer: 5
};

export function getEccOfficialTeamChatUrl() {
  return process.env.ECC_OFFICIAL_TEAM_CHAT_URL?.trim() || defaultEccOfficialTeamChatUrl;
}

export function isEccRoleAtLeast(role: EccRole, minimum: EccRole) {
  return roleRank[role] >= roleRank[minimum];
}

function emptyAccess(email = "", isLoggedIn = false): EccAccess {
  return {
    email,
    isAdmin: false,
    isDeveloper: false,
    isLoggedIn,
    isOfficialMember: false,
    isSuperAdmin: false,
    role: "user"
  };
}

export function toEccAccess(email: string, role: EccRole, isLoggedIn = true): EccAccess {
  return {
    email,
    isAdmin: isEccRoleAtLeast(role, "admin"),
    isDeveloper: role === "developer",
    isLoggedIn,
    isOfficialMember: isEccRoleAtLeast(role, "official_member"),
    isSuperAdmin: isEccRoleAtLeast(role, "super_admin"),
    role
  };
}

function resolveEccRole(
  adminAccess: Awaited<ReturnType<typeof getAdminAccess>>,
  roleRow: EccRoleRow | null
): EccRole {
  if (adminAccess.isDeveloper) {
    return "developer";
  }

  if (adminAccess.isSuperAdmin || roleRow?.super_admin_status === "approved") {
    return "super_admin";
  }

  if (roleRow?.admin_status === "approved") {
    return "admin";
  }

  if (
    roleRow?.official_member_status === "approved" ||
    roleRow?.is_official_member ||
    roleRow?.payment_confirmed
  ) {
    return "official_member";
  }

  return "user";
}

export async function getEccRoleRow(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return null;
  }

  try {
    const rows = await supabaseRequest<EccRoleRow[]>(
      `${eccRolesTable}?select=${eccRoleColumns}&email=eq.${encodeURIComponent(
        normalized
      )}&order=created_at.desc&limit=1`
    );

    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return null;
    }

    if (error instanceof SupabaseRequestError && error.status === 404) {
      return null;
    }

    console.error("ECC role lookup failed", error);
    return null;
  }
}

export async function getEccAccessForEmail(email?: string | null): Promise<EccAccess> {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return emptyAccess("", false);
  }

  const [adminAccess, roleRow] = await Promise.all([
    getAdminAccess(normalized),
    getEccRoleRow(normalized)
  ]);

  return toEccAccess(normalized, resolveEccRole(adminAccess, roleRow));
}

export async function getCurrentEccAccess() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);

  if (!session?.user || !email) {
    return emptyAccess("", false);
  }

  return getEccAccessForEmail(email);
}

async function writeEccRoleRow(
  email: string,
  body: Record<string, unknown>,
  existing?: EccRoleRow | null
) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw new Error("ECC role email is required.");
  }

  const now = new Date().toISOString();

  if (existing) {
    const rows = await supabaseRequest<EccRoleRow[]>(
      `${eccRolesTable}?id=eq.${encodeURIComponent(existing.id)}&select=${eccRoleColumns}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          ...body,
          updated_at: now
        })
      }
    );

    return rows[0] ?? existing;
  }

  const rows = await supabaseRequest<EccRoleRow[]>(`${eccRolesTable}?select=${eccRoleColumns}`, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      email: normalized,
      role: "user",
      ...body,
      updated_at: now
    })
  });

  return rows[0] ?? null;
}

export async function ensureEccRoleRow(input: {
  avatarUrl?: string;
  email: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    return null;
  }

  const existing = await getEccRoleRow(email);

  if (existing) {
    const avatarUrl = input.avatarUrl || existing.avatar_url || "";
    const name = input.name || existing.name || "";

    if (avatarUrl === (existing.avatar_url || "") && name === (existing.name || "")) {
      return existing;
    }

    return writeEccRoleRow(
      email,
      {
        avatar_url: avatarUrl,
        name
      },
      existing
    );
  }

  return writeEccRoleRow(email, {
    avatar_url: input.avatarUrl || "",
    name: input.name || "",
    role: "user"
  });
}

export async function patchEccRole(email: string, body: Record<string, unknown>) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw new Error("ECC role email is required.");
  }

  const existing = await getEccRoleRow(normalized);
  return writeEccRoleRow(normalized, body, existing);
}

export async function approveEccOfficialMember(input: {
  approvedBy: string;
  avatarUrl?: string;
  email: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    throw new Error("ECC role email is required.");
  }

  const [adminAccess, existing] = await Promise.all([
    getAdminAccess(email),
    getEccRoleRow(email)
  ]);
  const currentRole = resolveEccRole(adminAccess, existing);
  const nextRole =
    currentRole === "user" || currentRole === "official_member"
      ? "official_member"
      : currentRole;
  const now = new Date().toISOString();

  return writeEccRoleRow(
    email,
    {
      avatar_url: input.avatarUrl || existing?.avatar_url || "",
      is_official_member: true,
      name: input.name || existing?.name || "",
      official_member_status: "approved",
      payment_confirmed: true,
      payment_confirmed_at: now,
      payment_confirmed_by: input.approvedBy,
      role: nextRole
    },
    existing
  );
}

export async function revokeEccOfficialMember(input: {
  revokedBy: string;
  email: string;
  keepAdminRole?: boolean;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    throw new Error("ECC role email is required.");
  }

  const [adminAccess, existing] = await Promise.all([
    getAdminAccess(email),
    getEccRoleRow(email)
  ]);
  const currentAccess = toEccAccess(email, resolveEccRole(adminAccess, existing));

  if (input.keepAdminRole || currentAccess.isAdmin) {
    return writeEccRoleRow(
      email,
      {
        is_official_member: false,
        official_member_status: "rejected",
        payment_confirmed: false,
        payment_confirmed_by: input.revokedBy
      },
      existing
    );
  }

  return writeEccRoleRow(
    email,
    {
      admin_status: "none",
      is_official_member: false,
      official_member_status: "rejected",
      payment_confirmed: false,
      payment_confirmed_by: input.revokedBy,
      role: "user"
    },
    existing
  );
}
