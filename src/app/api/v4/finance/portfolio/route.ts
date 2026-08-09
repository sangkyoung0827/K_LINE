import { NextResponse } from "next/server";
import { getTossPortfolio, isTossInvestConfigured, TossInvestApiError, TossInvestConfigurationError } from "@/lib/finance-engine/tossInvest";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  if (!isTossInvestConfigured()) {
    return NextResponse.json({ state: "not_configured", provider: "Toss Securities", message: "Add the Toss Securities server environment variables to enable your private portfolio." });
  }

  try {
    return NextResponse.json({ state: "ready", provider: "Toss Securities", portfolio: await getTossPortfolio() });
  } catch (error) {
    if (error instanceof TossInvestConfigurationError) return NextResponse.json({ state: "not_configured", provider: "Toss Securities", message: error.message });
    if (error instanceof TossInvestApiError) {
      console.error("Toss portfolio request failed", { status: error.status, message: error.message });
      return NextResponse.json({ state: "unavailable", provider: "Toss Securities", message: "Toss Securities portfolio data is temporarily unavailable." }, { status: 502 });
    }
    console.error("Toss portfolio request failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ state: "unavailable", provider: "Toss Securities", message: "Toss Securities portfolio data is temporarily unavailable." }, { status: 503 });
  }
}
