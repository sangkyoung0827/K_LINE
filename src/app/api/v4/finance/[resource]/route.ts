import { NextResponse } from "next/server";
import { financeEngine } from "@/lib/finance-engine";
import { listRecentFinanceAnalyses } from "@/lib/finance-engine";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

const emptyResources = new Set(["portfolio", "positions", "performance", "trades", "signals", "strategies"]);

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;

  const { resource } = await params;

  if (resource === "overview") {
    return NextResponse.json(financeEngine.getOverview());
  }

  if (resource === "history") {
    return NextResponse.json({ data: await listRecentFinanceAnalyses(8), mode: "PAPER", state: "ready" });
  }

  if (emptyResources.has(resource)) {
    return NextResponse.json({ data: [], mode: "PAPER", state: "empty" });
  }

  return NextResponse.json({ error: "Unsupported finance resource." }, { status: 404 });
}
