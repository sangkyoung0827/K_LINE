import {
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export type AdminRole = "member" | "super_admin" | "developer";

export type AdminAccess = {
  email: string;
  role: AdminRole;
  isDeveloper: boolean;
  isSuperAdmin: boolean;
};

type AdminRoleRow = {
  id: string;
  created_at: string;
  email: string;
  role: string;
  status: string;
  granted_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
};

const adminRolesTable = "admin_roles";
const roleColumns = "id,created_at,email,role,status,granted_by,revoked_by,revoked_at";
const fallbackDeveloperEmails = [
  "waterfallingsound0827@gmail.com",
  "waterfallingsound0827@gamail.com"
];

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function getSuperAdminEmails() {
  return parseEmailList(process.env.SUPER_ADMIN_EMAILS);
}

export function getDeveloperEmails() {
  const configured = parseEmailList(process.env.DEVELOPER_EMAILS);
  return configured.length > 0 ? configured : fallbackDeveloperEmails;
}

export function isDeveloperEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && getDeveloperEmails().includes(normalized);
}

export function isSuperAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  return isDeveloperEmail(normalized) || getSuperAdminEmails().includes(normalized);
}

async function getLatestStoredSuperAdminRole(email: string) {
  try {
    const rows = await supabaseRequest<AdminRoleRow[]>(
      `${adminRolesTable}?select=${roleColumns}&email=eq.${encodeURIComponent(
        email
      )}&role=eq.super_admin&order=created_at.desc&limit=1`
    );

    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return null;
    }

    if (error instanceof SupabaseRequestError) {
      console.error("Admin role lookup failed", {
        status: error.status,
        message: error.message
      });
      return null;
    }

    console.error("Admin role lookup failed", error);
    return null;
  }
}

export async function getAdminAccess(email?: string | null): Promise<AdminAccess> {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return {
      email: "",
      role: "member",
      isDeveloper: false,
      isSuperAdmin: false
    };
  }

  if (isDeveloperEmail(normalized)) {
    return {
      email: normalized,
      role: "developer",
      isDeveloper: true,
      isSuperAdmin: true
    };
  }

  const storedRole = await getLatestStoredSuperAdminRole(normalized);

  if (storedRole?.status === "revoked") {
    return {
      email: normalized,
      role: "member",
      isDeveloper: false,
      isSuperAdmin: false
    };
  }

  if (storedRole?.status === "active" || getSuperAdminEmails().includes(normalized)) {
    return {
      email: normalized,
      role: "super_admin",
      isDeveloper: false,
      isSuperAdmin: true
    };
  }

  return {
    email: normalized,
    role: "member",
    isDeveloper: false,
    isSuperAdmin: false
  };
}

export async function hasSuperAdminAccess(email?: string | null) {
  return (await getAdminAccess(email)).isSuperAdmin;
}

export async function hasDeveloperAccess(email?: string | null) {
  return (await getAdminAccess(email)).isDeveloper;
}
