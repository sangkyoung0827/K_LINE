import { NextResponse } from "next/server";
import { cleanText, SupabaseConfigError, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";
import { getCurrentEccAccess } from "@/lib/eccAccess";

export const dynamic = "force-dynamic";

type FundRow = {
  account_holder: string;
  account_number: string;
  bank_name: string;
  displayed_balance_krw: number;
  id: string;
  total_donation_krw: number;
  updated_at: string;
  updated_by: string;
};

const columns = "id,bank_name,account_number,account_holder,total_donation_krw,displayed_balance_krw,updated_at,updated_by";

function toClient(row: FundRow) {
  return {
    accountHolder: row.account_holder,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    displayedBalance: Number(row.displayed_balance_krw ?? 0),
    totalDonationKrw: Number(row.total_donation_krw ?? 0),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
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

async function requireSuperAdmin() {
  const access = await getCurrentEccAccess();
  if (!access.isSuperAdmin) {
    return null;
  }
  return access;
}

export async function GET() {
  try {
    if (!(await requireSuperAdmin())) {
      return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
    }
    const rows = await supabaseRequest<FundRow[]>(`ecc_fund_settings?select=${columns}&id=eq.ecc&limit=1`);
    return NextResponse.json({ fund: rows[0] ? toClient(rows[0]) : null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireSuperAdmin();
    if (!access) {
      return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const numberValue = (value: unknown) => Math.max(0, Number.parseInt(String(value ?? "0"), 10) || 0);
    const rows = await supabaseRequest<FundRow[]>(`ecc_fund_settings?id=eq.ecc&select=${columns}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        account_holder: cleanText(body.accountHolder, 160),
        account_number: cleanText(body.accountNumber, 160),
        bank_name: cleanText(body.bankName, 160),
        displayed_balance_krw: numberValue(body.displayedBalance),
        total_donation_krw: numberValue(body.totalDonationKrw),
        updated_at: new Date().toISOString(),
        updated_by: access.email
      })
    });
    return NextResponse.json({ fund: rows[0] ? toClient(rows[0]) : null });
  } catch (error) {
    return errorResponse(error);
  }
}
