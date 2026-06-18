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

type EccMemberRow = {
  membership_fee_paid: boolean | null;
  status: string | null;
};

export const eccRolesTable = "ecc_roles";
export const eccRoleColumns =
  "id,created_at,updated_at,email,name,avatar_url,role,is_official_member,payment_confirmed,payment_confirmed_by,payment_confirmed_at,official_member_status,admin_status,admin_requested_at,admin_approved_by,admin_approved_at,super_admin_status,super_admin_requested_at,super_admin_approved_by,super_admin_approved_at";

export const defaultEccOfficialTeamChatUrl = "https://invite.kakao.com/tc/d3m2UO008Y";

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

async function hasPaidLegacyEccMember(email: string) {
  try {
    const rows = await supabaseRequest<EccMemberRow[]>(
      `ecc_members?select=membership_fee_paid,status&email=eq.${encodeURIComponent(
        email
      )}&order=created_at.desc&limit=1`
    );
    const row = rows[0];

    return Boolean(row?.membership_fee_paid) || row?.status === "active";
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return false;
    }

    if (error instanceof SupabaseRequestError && error.status === 404) {
      return false;
    }

    console.error("Legacy ECC member lookup failed", error);
    return false;
  }
}

export async function getEccAccessForEmail(email?: string | null): Promise<EccAccess> {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return emptyAccess("", false);
  }

  const adminAccess = await getAdminAccess(normalized);

  if (adminAccess.isDeveloper) {
    return toEccAccess(normalized, "developer");
  }

  const [roleRow, legacyPaidMember] = await Promise.all([
    getEccRoleRow(normalized),
    hasPaidLegacyEccMember(normalized)
  ]);

  if (adminAccess.isSuperAdmin || roleRow?.super_admin_status === "approved") {
    return toEccAccess(normalized, "super_admin");
  }

  if (roleRow?.admin_status === "approved") {
    return toEccAccess(normalized, "admin");
  }

  if (
    roleRow?.official_member_status === "approved" ||
    roleRow?.is_official_member ||
    roleRow?.payment_confirmed ||
    legacyPaidMember
  ) {
    return toEccAccess(normalized, "official_member");
  }

  return toEccAccess(normalized, "user");
}

export async function getCurrentEccAccess() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);

  if (!session?.user || !email) {
    return emptyAccess("", false);
  }

  return getEccAccessForEmail(email);
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

  const now = new Date().toISOString();
  const existing = await getEccRoleRow(email);

  if (existing) {
    const rows = await supabaseRequest<EccRoleRow[]>(
      `${eccRolesTable}?id=eq.${encodeURIComponent(existing.id)}&select=${eccRoleColumns}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          avatar_url: input.avatarUrl || existing.avatar_url || "",
          name: input.name || existing.name || "",
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
      avatar_url: input.avatarUrl || "",
      email,
      name: input.name || "",
      role: "user",
      updated_at: now
    })
  });

  return rows[0] ?? null;
}

export async function patchEccRole(email: string, body: Record<string, unknown>) {
  const existing = await ensureEccRoleRow({ email });

  if (!existing) {
    throw new Error("ECC role row could not be created.");
  }

  const rows = await supabaseRequest<EccRoleRow[]>(
    `${eccRolesTable}?id=eq.${encodeURIComponent(existing.id)}&select=${eccRoleColumns}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ...body,
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows[0] ?? existing;
}

export async function approveEccOfficialMember(input: {
  approvedBy: string;
  avatarUrl?: string;
  email: string;
  name?: string;
}) {
  const now = new Date().toISOString();
  const currentAccess = await getEccAccessForEmail(input.email);
  const nextRole =
    currentAccess.role === "user" || currentAccess.role === "official_member"
      ? "official_member"
      : currentAccess.role;

  await ensureEccRoleRow({
    avatarUrl: input.avatarUrl,
    email: input.email,
    name: input.name
  });

  return patchEccRole(input.email, {
    avatar_url: input.avatarUrl || "",
    is_official_member: true,
    name: input.name || "",
    official_member_status: "approved",
    payment_confirmed: true,
    payment_confirmed_at: now,
    payment_confirmed_by: input.approvedBy,
    role: nextRole
  });
}

export async function revokeEccOfficialMember(input: {
  revokedBy: string;
  email: string;
  keepAdminRole?: boolean;
}) {
  const currentAccess = await getEccAccessForEmail(input.email);

  if (input.keepAdminRole || currentAccess.isAdmin) {
    return patchEccRole(input.email, {
      is_official_member: false,
      official_member_status: "rejected",
      payment_confirmed: false,
      payment_confirmed_by: input.revokedBy
    });
  }

  return patchEccRole(input.email, {
    admin_status: "none",
    is_official_member: false,
    official_member_status: "rejected",
    payment_confirmed: false,
    payment_confirmed_by: input.revokedBy,
    role: "user"
  });
}
