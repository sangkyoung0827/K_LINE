import { NextResponse } from "next/server";
import { parseMetric, parsePage, parsePeriod, TraditionalLiquorAnalyticsService } from "@/lib/traditional-liquor/analytics";
import { repairRecentNaverPurchaseMetrics } from "@/lib/traditional-liquor/collector/sales-metric-repair";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const service = new TraditionalLiquorAnalyticsService();
    const metric = parseMetric(params.get("metric"));
    const period = parsePeriod(params.get("period"));
    const platform = params.get("platform") ?? "";
    const input = {
      query: params.get("q") ?? "", platform,
      metric, period,
      page: parsePage(params.get("page")), limit: 50
    };

    let results = await service.getSalesAnalytics(input);
    const shouldRepairNaverPurchases = results.total === 0
      && metric === "SOURCE_PURCHASE_COUNT"
      && (!platform.trim() || platform.trim().toUpperCase() === "NAVER");

    if (shouldRepairNaverPurchases) {
      const repaired = await repairRecentNaverPurchaseMetrics().catch((error) => {
        console.error("Traditional liquor collector purchase metric repair failed", error);
        return 0;
      });
      if (repaired > 0) results = await service.getSalesAnalytics(input);
    }

    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Traditional liquor sales analytics error", error);
    return NextResponse.json({ error: "판매·인기도 분석 데이터를 불러오지 못했습니다.", debugCode: "TL_SALES_ANALYTICS_V1" }, { status: 500 });
  }
}
