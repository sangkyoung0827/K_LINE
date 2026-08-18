import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDeveloperEmails,
  isDeveloperEmail,
  normalizeEmail
} from "@/lib/admin";
import {
  cleanText,
  SupabaseConfigError,
  SupabaseRequestError,
  supabaseRequest
} from "@/lib/supabaseServer";
import {
  hanhwalRoleColumns,
  hanhwalRolesTable,
  ensureHanhwalRoleRow,
  getCurrentHanhwalAccess,
  getHanhwalAccessForEmail,
  getHanhwalOfficialTeamChatUrl,
  type HanhwalRoleRow
} from "@/lib/hanhwalAccess";

export const dynamic = "force-dynamic";

function parseSupabaseError(error: SupabaseRequestError) {
  try {
    return JSON.parse(error.message) as {
      code?: string;
      details?: string;
      hint?: string;
      message?: string;
    };
  } catch {
    return { message: error.message };
  }
}

function apiErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error: "HANHWAL role storage is not configured yet.",
        debugCode: "HANHWAL_ROLE_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const parsed = parseSupabaseError(error);
    console.error("HANHWAL role Supabase error", {
      code: parsed.code,
      details: parsed.details,
      hint: parsed.hint,
      message: parsed.message ?? error.message,
      status: error.status
    });

    if (error.status === 404) {
      return NextResponse.json(
        {
          error: "HANHWAL role table is not ready yet.",
          debugCode: "HANHWAL_ROLE_TABLE_NOT_READY"
        },
        { status: 503 }
      );
    }
  } else {
    console.error("HANHWAL role API error", error);
  }

  return NextResponse.json(
    {
      error: "HANHWAL role storage is temporarily unavailable.",
      debugCode: "HANHWAL_ROLE_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
}

function toRoleSummary(row?: HanhwalRoleRow | null) {
  return {
    adminApprovedAt: row?.admin_approved_at ?? "",
    adminApprovedBy: row?.admin_approved_by ?? "",
    adminRequestedAt: row?.admin_requested_at ?? "",
    adminStatus: row?.admin_status ?? "none",
    avatarUrl: row?.avatar_url ?? "",
    createdAt: row?.created_at ?? "",
    email: row?.email ?? "",
    id: row?.id ?? "",
    isOfficialMember: Boolean(row?.is_official_member),
    name: row?.name ?? "",
    officialMemberStatus: row?.official_member_status ?? "none",
    paymentConfirmed: Boolean(row?.payment_confirmed),
    paymentConfirmedAt: row?.payment_confirmed_at ?? "",
    paymentConfirmedBy: row?.payment_confirmed_by ?? "",
    role: row?.role ?? "user",
    superAdminApprovedAt: row?.super_admin_approved_at ?? "",
    superAdminApprovedBy: row?.super_admin_approved_by ?? "",
    superAdminRequestedAt: row?.super_admin_requested_at ?? "",
    superAdminStatus: row?.super_admin_status ?? "none",
    updatedAt: row?.updated_at ?? ""
  };
}

async function listHanhwalRoles() {
  return supabaseRequest<HanhwalRoleRow[]>(
    `${hanhwalRolesTable}?select=${hanhwalRoleColumns}&order=updated_at.desc.nullslast&limit=500`
  );
}

function latestRoleMap(rows: HanhwalRoleRow[]) {
  const map = new Map<string, HanhwalRoleRow>();

  rows.forEach((row) => {
    const email = normalizeEmail(row.email);

    if (email && !map.has(email)) {
      map.set(email, row);
    }
  });

  return map;
}

async function patchRole(email: string, body: Record<string, unknown>) {
  const existing = await ensureHanhwalRoleRow({ email });

  if (!existing) {
    throw new Error("HANHWAL role row could not be created.");
  }

  const rows = await supabaseRequest<HanhwalRoleRow[]>(
    `${hanhwalRolesTable}?id=eq.${encodeURIComponent(existing.id)}&select=${hanhwalRoleColumns}`,
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

async function buildResponse() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isLoggedIn) {
    return {
      developerInfo: null,
      me: access,
      members: [],
      roleRequests: {
        admin: [],
        superAdmin: []
      }
    };
  }

  if (!access.isAdmin) {
    return {
      developerInfo: null,
      me: access,
      members: [],
      roleRequests: {
        admin: [],
        superAdmin: []
      }
    };
  }

  const roleRows = await listHanhwalRoles();
  const rolesByEmail = latestRoleMap(roleRows);

  const allMembers = await Promise.all(
    Array.from(rolesByEmail.keys())
      .filter(Boolean)
      .sort()
      .map(async (email) => {
        const roleRow = rolesByEmail.get(email);
        const memberAccess = await getHanhwalAccessForEmail(email);

        return {
          access: memberAccess,
          avatarUrl: roleRow?.avatar_url || "",
          createdAt: roleRow?.created_at || "",
          email,
          lastLoginAt: "",
          name: roleRow?.name || "",
          roleStatus: toRoleSummary(roleRow),
          siteStatus: ""
        };
      })
  );
  const members = access.isDeveloper
    ? allMembers
    : allMembers.filter((member) => !member.access.isDeveloper && !isDeveloperEmail(member.email));

  return {
    developerInfo: access.isDeveloper
      ? {
          developerEmails: getDeveloperEmails(),
          hanhwalOfficialTeamChatUrl: getHanhwalOfficialTeamChatUrl(),
          superAdminEmails: roleRows
            .filter((row) => row.super_admin_status === "approved")
            .map((row) => normalizeEmail(row.email))
            .filter(Boolean)
        }
      : null,
    me: access,
    members,
    roleRequests: {
      admin: members.filter((member) => member.roleStatus.adminStatus === "requested"),
      superAdmin: members.filter((member) => member.roleStatus.superAdminStatus === "requested")
    }
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
    const session = await auth();
    const access = await getCurrentHanhwalAccess();

    if (!access.isLoggedIn || !access.email) {
      return NextResponse.json({ error: "Login is required." }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action, 80);
    const now = new Date().toISOString();

    await ensureHanhwalRoleRow({
      avatarUrl: session?.user?.image ?? "",
      email: access.email,
      name: session?.user?.name ?? ""
    });

    if (action === "request_admin") {
      if (!access.isOfficialMember || access.isAdmin) {
        return NextResponse.json(
          { error: "Official member access is required before requesting admin permission." },
          { status: 403 }
        );
      }

      await patchRole(access.email, {
        admin_requested_at: now,
        admin_status: "requested"
      });
      return NextResponse.json(await buildResponse(), { status: 201 });
    }

    if (action === "request_super_admin") {
      if (!access.isAdmin || access.isSuperAdmin) {
        return NextResponse.json(
          { error: "Admin access is required before requesting super-admin permission." },
          { status: 403 }
        );
      }

      await patchRole(access.email, {
        super_admin_requested_at: now,
        super_admin_status: "requested"
      });
      return NextResponse.json(await buildResponse(), { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported HANHWAL role request." }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await getCurrentHanhwalAccess();

    if (!access.isAdmin) {
      return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action, 80);
    const targetEmail = normalizeEmail(cleanText(body.email, 240));
    const now = new Date().toISOString();

    if (!targetEmail) {
      return NextResponse.json({ error: "Target email is required." }, { status: 400 });
    }

    if (!access.isDeveloper && isDeveloperEmail(targetEmail)) {
      return NextResponse.json(
        { error: "Developer account information is available only to developer accounts." },
        { status: 403 }
      );
    }

    if (action === "approve_official_member") {
      await patchRole(targetEmail, {
        is_official_member: true,
        official_member_status: "approved",
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: access.email,
        role: "official_member"
      });
      return NextResponse.json(await buildResponse());
    }

    if (action === "revoke_official_member") {
      await patchRole(targetEmail, {
        admin_status: "none",
        is_official_member: false,
        official_member_status: "rejected",
        payment_confirmed: false,
        role: "user"
      });
      return NextResponse.json(await buildResponse());
    }

    if (action === "approve_admin") {
      if (!access.isSuperAdmin) {
        return NextResponse.json(
          { error: "Super-admin access is required to approve admin requests." },
          { status: 403 }
        );
      }

      await patchRole(targetEmail, {
        admin_approved_at: now,
        admin_approved_by: access.email,
        admin_status: "approved",
        is_official_member: true,
        official_member_status: "approved",
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: access.email,
        role: "admin"
      });
      return NextResponse.json(await buildResponse());
    }

    if (action === "revoke_admin") {
      if (!access.isSuperAdmin) {
        return NextResponse.json(
          { error: "Super-admin access is required to revoke admin access." },
          { status: 403 }
        );
      }

      await patchRole(targetEmail, {
        admin_status: "rejected",
        role: "official_member",
        super_admin_status: "none"
      });
      return NextResponse.json(await buildResponse());
    }

    if (action === "approve_super_admin") {
      if (!access.isDeveloper) {
        return NextResponse.json(
          { error: "Developer access is required to approve super-admin requests." },
          { status: 403 }
        );
      }

      await patchRole(targetEmail, {
        admin_status: "approved",
        is_official_member: true,
        official_member_status: "approved",
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: access.email,
        role: "super_admin",
        super_admin_approved_at: now,
        super_admin_approved_by: access.email,
        super_admin_status: "approved"
      });
      return NextResponse.json(await buildResponse());
    }

    if (action === "revoke_super_admin") {
      if (!access.isDeveloper) {
        return NextResponse.json(
          { error: "Developer access is required to revoke super-admin access." },
          { status: 403 }
        );
      }

      await patchRole(targetEmail, {
        role: "admin",
        super_admin_status: "rejected"
      });
      return NextResponse.json(await buildResponse());
    }

    return NextResponse.json({ error: "Unsupported HANHWAL role action." }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
