import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAdminAccess,
  getDeveloperEmails,
  getSuperAdminEmails,
  isDeveloperEmail,
  normalizeEmail
} from "@/lib/admin";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RoleRequestRow = {
  id: string;
  created_at: string;
  email: string;
  name: string | null;
  reason: string | null;
  requested_role: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type RoleRow = {
  id: string;
  created_at: string;
  email: string;
  role: string;
  status: string;
  granted_by: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
};

const requestsTable = "admin_role_requests";
const rolesTable = "admin_roles";
const requestColumns =
  "id,created_at,email,name,reason,requested_role,status,reviewed_by,reviewed_at";
const roleColumns = "id,created_at,email,role,status,granted_by,revoked_by,revoked_at";

function toClientRequest(row: RoleRequestRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    email: row.email,
    name: row.name ?? "",
    reason: row.reason ?? "",
    requestedRole: row.requested_role,
    status: row.status,
    reviewedBy: row.reviewed_by ?? "",
    reviewedAt: row.reviewed_at ?? ""
  };
}

function toClientAdmin(row: RoleRow, source: "database" | "environment" | "developer") {
  return {
    id: row.id,
    createdAt: row.created_at,
    email: row.email,
    role: row.role,
    status: row.status,
    grantedBy: row.granted_by ?? "",
    revokedBy: row.revoked_by ?? "",
    revokedAt: row.revoked_at ?? "",
    source
  };
}

function parseSupabaseError(error: SupabaseRequestError) {
  try {
    const parsed = JSON.parse(error.message) as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    return {
      message: parsed.message ?? error.message,
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint
    };
  } catch {
    return {
      message: error.message,
      code: undefined,
      details: undefined,
      hint: undefined
    };
  }
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error: "Admin role storage is not configured yet.",
        debugCode: "ADMIN_ROLE_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const supabaseError = parseSupabaseError(error);
    console.error("Admin role Supabase error", {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });

    if (error.status === 404) {
      return NextResponse.json(
        {
          error: "Admin role tables are not ready yet.",
          debugCode: "ADMIN_ROLE_TABLES_NOT_READY"
        },
        { status: 503 }
      );
    }
  } else {
    console.error("Admin role API error", error);
  }

  return NextResponse.json(
    {
      error: "Admin role storage is temporarily unavailable.",
      debugCode: "ADMIN_ROLE_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

async function getSessionContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  const name = session?.user?.name ?? "";
  const access = await getAdminAccess(email);

  return {
    access,
    email,
    isLoggedIn: Boolean(session?.user),
    name
  };
}

async function listRequestsFor(email: string, includeAll: boolean) {
  const filter = includeAll ? "" : `&email=eq.${encodeURIComponent(email)}`;
  return supabaseRequest<RoleRequestRow[]>(
    `${requestsTable}?select=${requestColumns}${filter}&order=created_at.desc&limit=80`
  );
}

async function listRoleRows() {
  return supabaseRequest<RoleRow[]>(
    `${rolesTable}?select=${roleColumns}&role=eq.super_admin&order=created_at.desc&limit=200`
  );
}

function latestRowsByEmail(rows: RoleRow[]) {
  const latest = new Map<string, RoleRow>();

  rows.forEach((row) => {
    const email = normalizeEmail(row.email);

    if (!email || latest.has(email)) {
      return;
    }

    latest.set(email, row);
  });

  return latest;
}

async function listAdmins() {
  const rows = await listRoleRows();
  const latest = latestRowsByEmail(rows);
  const admins = new Map<string, ReturnType<typeof toClientAdmin>>();

  getDeveloperEmails().forEach((email) => {
    admins.set(email, {
      id: `developer:${email}`,
      createdAt: "",
      email,
      role: "developer",
      status: "active",
      grantedBy: "system",
      revokedBy: "",
      revokedAt: "",
      source: "developer"
    });
  });

  getSuperAdminEmails().forEach((email) => {
    const stored = latest.get(email);

    if (stored?.status === "revoked" || isDeveloperEmail(email)) {
      return;
    }

    admins.set(email, {
      id: `environment:${email}`,
      createdAt: "",
      email,
      role: "super_admin",
      status: "active",
      grantedBy: "environment",
      revokedBy: "",
      revokedAt: "",
      source: "environment"
    });
  });

  rows.forEach((row) => {
    const email = normalizeEmail(row.email);

    if (!email || isDeveloperEmail(email)) {
      return;
    }

    const latestRow = latest.get(email);

    if (latestRow?.id !== row.id || row.status !== "active") {
      return;
    }

    admins.set(email, toClientAdmin(row, "database"));
  });

  return Array.from(admins.values()).sort((a, b) => a.email.localeCompare(b.email));
}

async function listPendingRequest(email: string) {
  return supabaseRequest<RoleRequestRow[]>(
    `${requestsTable}?select=${requestColumns}&email=eq.${encodeURIComponent(
      email
    )}&requested_role=eq.super_admin&status=eq.pending&order=created_at.desc&limit=1`
  );
}

async function activeOrLatestRole(email: string) {
  const rows = await supabaseRequest<RoleRow[]>(
    `${rolesTable}?select=${roleColumns}&email=eq.${encodeURIComponent(
      email
    )}&role=eq.super_admin&order=created_at.desc&limit=1`
  );

  return rows[0] ?? null;
}

async function grantSuperAdmin(email: string, grantedBy: string) {
  const latestRole = await activeOrLatestRole(email);

  if (latestRole?.status === "active") {
    return latestRole;
  }

  const rows = await supabaseRequest<RoleRow[]>(`${rolesTable}?select=${roleColumns}`, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      email,
      role: "super_admin",
      status: "active",
      granted_by: grantedBy
    })
  });

  return rows[0];
}

async function buildResponse() {
  const context = await getSessionContext();

  if (!context.isLoggedIn) {
    return {
      admins: [],
      me: {
        email: "",
        isDeveloper: false,
        isLoggedIn: false,
        isSuperAdmin: false,
        role: "member"
      },
      requests: []
    };
  }

  const requests = await listRequestsFor(context.email, context.access.isSuperAdmin);
  const admins = context.access.isDeveloper ? await listAdmins() : [];

  return {
    admins,
    me: {
      email: context.email,
      isDeveloper: context.access.isDeveloper,
      isLoggedIn: true,
      isSuperAdmin: context.access.isSuperAdmin,
      role: context.access.role
    },
    requests: requests.map(toClientRequest)
  };
}

export async function GET() {
  try {
    return NextResponse.json(await buildResponse());
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getSessionContext();

    if (!context.isLoggedIn || !context.email) {
      return NextResponse.json(
        { error: "Login is required before requesting super-admin access." },
        { status: 401 }
      );
    }

    if (context.access.isSuperAdmin) {
      return NextResponse.json(
        { error: "This account already has super-admin access." },
        { status: 409 }
      );
    }

    const existing = await listPendingRequest(context.email);

    if (existing[0]) {
      return NextResponse.json(await buildResponse());
    }

    const body = (await request.json()) as Record<string, unknown>;
    await supabaseRequest<RoleRequestRow[]>(`${requestsTable}?select=${requestColumns}`, {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        email: context.email,
        name: cleanText(body.name) || context.name || context.email,
        reason: cleanText(body.reason, 1000),
        requested_role: "super_admin",
        status: "pending"
      })
    });

    return NextResponse.json(await buildResponse(), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getSessionContext();

    if (!context.access.isSuperAdmin) {
      return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action);
    const targetEmail = normalizeEmail(cleanText(body.email));
    const now = new Date().toISOString();

    if (action === "approve") {
      const requestId = cleanText(body.requestId, 120);

      if (!requestId) {
        return NextResponse.json({ error: "Request id is required." }, { status: 400 });
      }

      const requests = await supabaseRequest<RoleRequestRow[]>(
        `${requestsTable}?select=${requestColumns}&id=eq.${encodeURIComponent(requestId)}&limit=1`
      );
      const roleRequest = requests[0];

      if (!roleRequest || roleRequest.status !== "pending") {
        return NextResponse.json({ error: "Pending request was not found." }, { status: 404 });
      }

      await grantSuperAdmin(normalizeEmail(roleRequest.email), context.email);
      await supabaseRequest<RoleRequestRow[]>(
        `${requestsTable}?id=eq.${encodeURIComponent(requestId)}&select=${requestColumns}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            reviewed_at: now,
            reviewed_by: context.email,
            status: "approved"
          })
        }
      );

      return NextResponse.json(await buildResponse());
    }

    if (action === "grant") {
      if (!context.access.isDeveloper) {
        return NextResponse.json(
          { error: "Developer access is required to directly register super admins." },
          { status: 403 }
        );
      }

      if (!targetEmail) {
        return NextResponse.json({ error: "Target email is required." }, { status: 400 });
      }

      await grantSuperAdmin(targetEmail, context.email);
      return NextResponse.json(await buildResponse());
    }

    if (action === "revoke") {
      if (!context.access.isDeveloper) {
        return NextResponse.json(
          { error: "Developer access is required to remove super admins." },
          { status: 403 }
        );
      }

      if (!targetEmail) {
        return NextResponse.json({ error: "Target email is required." }, { status: 400 });
      }

      if (isDeveloperEmail(targetEmail)) {
        return NextResponse.json(
          { error: "Developer accounts cannot be revoked from the super-admin list." },
          { status: 400 }
        );
      }

      await supabaseRequest<RoleRow[]>(`${rolesTable}?select=${roleColumns}`, {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          email: targetEmail,
          role: "super_admin",
          status: "revoked",
          granted_by: context.email,
          revoked_by: context.email,
          revoked_at: now
        })
      });

      return NextResponse.json(await buildResponse());
    }

    return NextResponse.json({ error: "Unsupported admin role action." }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
