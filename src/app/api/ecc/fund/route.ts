import { NextResponse } from "next/server";
import { SupabaseConfigError, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";
import { getCurrentEccAccess } from "@/lib/eccAccess";

export const dynamic = "force-dynamic";

type FundRow = {
  displayed_balance_krw: number;
  id: string;
  updated_at: string;
};

const columns = "id,displayed_balance_krw,updated_at";

function toClient(row: FundRow) {
  return {
    displayedBalance: Number(row.displayed_balance_krw ?? 0),
    updatedAt: row.updated_at
  };
}

function errorResponse(error: unknown) {
  if (error instanceof SupabaseConfigError) {
    return NextResponse.json({ error: "ECC fund storage is not configured." }, { status: 503 });
  }
  if (error instanceof SupabaseRequestError && error.status === 404) {
    return NextResponse.json({ error: "ECC fund table is not ready." }, { status: 503 });
  }
  console.error("ECC fund API error", error);
  return NextResponse.json({ error: "ECC fund storage is temporarily unavailable." }, { status: 500 });
}

async function requireAdmin() {
  const access = await getCurrentEccAccess();
  if (!access.isAdmin) {
    return null;
  }
  return access;
}

export async function GET() {
  try {
    const access = await getCurrentEccAccess();

    if (!access.isAdmin) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: access.isLoggedIn ? 403 : 401 }
      );
    }

    const rows = await supabaseRequest<FundRow[]>(`ecc_fund_settings?select=${columns}&id=eq.ecc&limit=1`);
    return NextResponse.json({ fund: rows[0] ? toClient(rows[0]) : null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdmin();
    if (!access) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const numberValue = (value: unknown) => Math.max(0, Number.parseInt(String(value ?? "0"), 10) || 0);
    const rows = await supabaseRequest<FundRow[]>(`ecc_fund_settings?id=eq.ecc&select=${columns}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        displayed_balance_krw: numberValue(body.displayedBalance),
        updated_at: new Date().toISOString(),
        updated_by: access.email
      })
    });
    return NextResponse.json({ fund: rows[0] ? toClient(rows[0]) : null });
  } catch (error) {
    return errorResponse(error);
  }
}
