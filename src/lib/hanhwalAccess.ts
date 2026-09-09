import "server-only";

import { auth } from "@/auth";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import {
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export type HanhwalRole = "user" | "official_member" | "admin" | "super_admin" | "developer";

export type HanhwalAccess = {
  email: string;
  isAdmin: boolean;
  isDeveloper: boolean;
  isLoggedIn: boolean;
  isOfficialMember: boolean;
  isSuperAdmin: boolean;
  role: HanhwalRole;
};

export type HanhwalRoleRow = {
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

export const hanhwalRolesTable = "hanhwal_roles";
export const hanhwalRoleColumns =
  "id,created_at,updated_at,email,name,avatar_url,role,is_official_member,payment_confirmed,payment_confirmed_by,payment_confirmed_at,official_member_status,admin_status,admin_requested_at,admin_approved_by,admin_approved_at,super_admin_status,super_admin_requested_at,super_admin_approved_by,super_admin_approved_at";

export const defaultHanhwalOfficialTeamChatUrl = "";

const roleRank: Record<HanhwalRole, number> = {
  user: 1,
  official_member: 2,
  admin: 3,
  super_admin: 4,
  developer: 5
};

export function getHanhwalOfficialTeamChatUrl() {
  return process.env.HANHWAL_OFFICIAL_TEAM_CHAT_URL?.trim() || defaultHanhwalOfficialTeamChatUrl;
}

export function isHanhwalRoleAtLeast(role: HanhwalRole, minimum: HanhwalRole) {
  return roleRank[role] >= roleRank[minimum];
}

function emptyAccess(email = "", isLoggedIn = false): HanhwalAccess {
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

export function toHanhwalAccess(email: string, role: HanhwalRole, isLoggedIn = true): HanhwalAccess {
  return {
    email,
    isAdmin: isHanhwalRoleAtLeast(role, "admin"),
    isDeveloper: role === "developer",
    isLoggedIn,
    isOfficialMember: isHanhwalRoleAtLeast(role, "official_member"),
    isSuperAdmin: isHanhwalRoleAtLeast(role, "super_admin"),
    role
  };
}

function resolveHanhwalRole(
  adminAccess: Awaited<ReturnType<typeof getAdminAccess>>,
  roleRow: HanhwalRoleRow | null
): HanhwalRole {
  if (adminAccess.isDeveloper) {
    return "developer";
  }

  if (roleRow?.super_admin_status === "approved") {
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

export async function getHanhwalRoleRow(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return null;
  }

  try {
    const rows = await supabaseRequest<HanhwalRoleRow[]>(
      `${hanhwalRolesTable}?select=${hanhwalRoleColumns}&email=eq.${encodeURIComponent(
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

    console.error("HANHWAL role lookup failed", error);
    return null;
  }
}

export async function getHanhwalAccessForEmail(email?: string | null): Promise<HanhwalAccess> {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return emptyAccess("", false);
  }

  const [adminAccess, roleRow] = await Promise.all([
    getAdminAccess(normalized),
    getHanhwalRoleRow(normalized)
  ]);

  return toHanhwalAccess(normalized, resolveHanhwalRole(adminAccess, roleRow));
}

export async function getCurrentHanhwalAccess() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);

  if (!session?.user || !email) {
    return emptyAccess("", false);
  }

  return getHanhwalAccessForEmail(email);
}

async function writeHanhwalRoleRow(
  email: string,
  body: Record<string, unknown>,
  existing?: HanhwalRoleRow | null
) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw new Error("HANHWAL role email is required.");
  }

  const now = new Date().toISOString();

  if (existing) {
    const rows = await supabaseRequest<HanhwalRoleRow[]>(
      `${hanhwalRolesTable}?id=eq.${encodeURIComponent(existing.id)}&select=${hanhwalRoleColumns}`,
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

  const rows = await supabaseRequest<HanhwalRoleRow[]>(`${hanhwalRolesTable}?select=${hanhwalRoleColumns}`, {
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

export async function ensureHanhwalRoleRow(input: {
  avatarUrl?: string;
  email: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    return null;
  }

  const existing = await getHanhwalRoleRow(email);

  if (existing) {
    const avatarUrl = input.avatarUrl || existing.avatar_url || "";
    const name = input.name || existing.name || "";

    if (avatarUrl === (existing.avatar_url || "") && name === (existing.name || "")) {
      return existing;
    }

    return writeHanhwalRoleRow(
      email,
      {
        avatar_url: avatarUrl,
        name
      },
      existing
    );
  }

  return writeHanhwalRoleRow(email, {
    avatar_url: input.avatarUrl || "",
    name: input.name || "",
    role: "user"
  });
}

export async function patchHanhwalRole(email: string, body: Record<string, unknown>) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw new Error("HANHWAL role email is required.");
  }

  const existing = await getHanhwalRoleRow(normalized);
  return writeHanhwalRoleRow(normalized, body, existing);
}

export async function approveHanhwalOfficialMember(input: {
  approvedBy: string;
  avatarUrl?: string;
  email: string;
  name?: string;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    throw new Error("HANHWAL role email is required.");
  }

  const [adminAccess, existing] = await Promise.all([
    getAdminAccess(email),
    getHanhwalRoleRow(email)
  ]);
  const currentRole = resolveHanhwalRole(adminAccess, existing);
  const nextRole =
    currentRole === "user" || currentRole === "official_member"
      ? "official_member"
      : currentRole;
  const now = new Date().toISOString();

  return writeHanhwalRoleRow(
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

export async function revokeHanhwalOfficialMember(input: {
  revokedBy: string;
  email: string;
  keepAdminRole?: boolean;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    throw new Error("HANHWAL role email is required.");
  }

  const [adminAccess, existing] = await Promise.all([
    getAdminAccess(email),
    getHanhwalRoleRow(email)
  ]);
  const currentAccess = toHanhwalAccess(email, resolveHanhwalRole(adminAccess, existing));

  if (input.keepAdminRole || currentAccess.isAdmin) {
    return writeHanhwalRoleRow(
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

  return writeHanhwalRoleRow(
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
