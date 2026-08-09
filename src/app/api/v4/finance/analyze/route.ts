import { NextResponse } from "next/server";
import { financeEngine } from "@/lib/finance-engine";
import { cleanText } from "@/lib/supabaseServer";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  const body = (await request.json()) as { symbol?: unknown };
  const symbol = cleanText(body.symbol, 12).toUpperCase();

  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) {
    return NextResponse.json({ error: "A valid symbol is required." }, { status: 400 });
  }

  return NextResponse.json(financeEngine.analyze(symbol));
}

