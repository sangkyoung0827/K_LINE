import { NextResponse } from "next/server";
import { FinanceJobCapacityError, FinanceJobTimeoutError, financeEngine, isValidFinanceSymbol, normalizeFinanceSymbol, runBoundedFinanceJob } from "@/lib/finance-engine";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  const body = (await request.json()) as { symbol?: unknown };
  const symbol = normalizeFinanceSymbol(body.symbol);

  if (!isValidFinanceSymbol(symbol)) {
    return NextResponse.json({ error: "A valid symbol is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await runBoundedFinanceJob(() => financeEngine.analyze(symbol)));
  } catch (error) {
    if (error instanceof FinanceJobCapacityError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof FinanceJobTimeoutError) return NextResponse.json({ error: error.message }, { status: 504 });
    return NextResponse.json({ error: "Finance analysis is temporarily unavailable." }, { status: 503 });
  }
}
