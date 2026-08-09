import { NextResponse } from "next/server";
import { FinanceJobCapacityError, FinanceJobTimeoutError, FinanceMarketDataError, FinanceProviderError, financeEngine, isValidFinanceSymbol, normalizeFinanceSymbol, runBoundedFinanceJob } from "@/lib/finance-engine";
import { getTossPortfolio, TossInvestApiError, TossInvestConfigurationError } from "@/lib/finance-engine/tossInvest";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  const body = (await request.json()) as { symbol?: unknown };
  const symbol = normalizeFinanceSymbol(body.symbol);
  if (!isValidFinanceSymbol(symbol)) return NextResponse.json({ error: "A valid symbol is required." }, { status: 400 });

  try {
    const [portfolio, analysis] = await Promise.all([
      getTossPortfolio(),
      runBoundedFinanceJob(({ signal }) => financeEngine.analyze(symbol, signal))
    ]);
    const holding = portfolio.holdings.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
    const positionContext = holding
      ? `${holding.name}: ${holding.quantity} shares held, ${holding.allocationPercent?.toFixed(1) ?? "—"}% of its currency portfolio.`
      : "This symbol is not currently held in the connected portfolio.";
    return NextResponse.json({
      state: "manual_review",
      analysis,
      portfolio,
      proposal: {
        action: analysis.decision.action,
        symbol,
        positionContext,
        message: "Research proposal only. No broker order, conditional order, or money movement was created. Confirm every trade independently in the Toss Securities app."
      }
    });
  } catch (error) {
    if (error instanceof TossInvestConfigurationError) return NextResponse.json({ error: "Toss Securities is not configured." }, { status: 503 });
    if (error instanceof TossInvestApiError) {
      console.error("Toss portfolio proposal failed", { status: error.status, message: error.message });
      return NextResponse.json({ error: "Toss Securities portfolio data is temporarily unavailable." }, { status: 502 });
    }
    if (error instanceof FinanceJobCapacityError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof FinanceJobTimeoutError) return NextResponse.json({ error: error.message }, { status: 504 });
    if (error instanceof FinanceMarketDataError) return NextResponse.json({ error: "Market data is temporarily unavailable." }, { status: 502 });
    if (error instanceof FinanceProviderError) return NextResponse.json({ error: "Finance AI provider is temporarily unavailable." }, { status: 502 });
    console.error("Toss portfolio proposal failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Portfolio research is temporarily unavailable." }, { status: 503 });
  }
}
