import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasSuperAdminAccess, normalizeEmail } from "@/lib/admin";
import { SupabaseConfigError, SupabaseRequestError } from "@/lib/supabaseServer";

export async function requireMemberRegistrationAdmin() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);

  if (!email || !(await hasSuperAdminAccess(email))) {
    return "";
  }

  return email;
}

export function forbiddenMemberRegistrationResponse() {
  return NextResponse.json(
    {
      error: "Super-admin access is required for member registration management.",
      debugCode: "MEMBER_REGISTRATION_FORBIDDEN"
    },
    { status: 403 }
  );
}

export function memberRegistrationErrorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json(
      {
        error: "Member registration storage is not configured yet.",
        debugCode: "MEMBER_REGISTRATION_SUPABASE_CONFIG_MISSING"
      },
      { status: 503 }
    );
  }

  if (error instanceof SupabaseRequestError) {
    const supabaseError = parseSupabaseError(error);
    console.error("Member registration Supabase error", {
      status: error.status,
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint
    });

    if (error.status === 404) {
      return NextResponse.json(
        {
          error: "Member registration tables are not ready yet.",
          debugCode: "MEMBER_REGISTRATION_TABLES_NOT_READY"
        },
        { status: 503 }
      );
    }
  } else {
    console.error("Member registration API error", error);
  }

  return NextResponse.json(
    {
      error: "Member registration storage is temporarily unavailable.",
      debugCode: "MEMBER_REGISTRATION_STORAGE_UNAVAILABLE"
    },
    { status: 500 }
  );
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
