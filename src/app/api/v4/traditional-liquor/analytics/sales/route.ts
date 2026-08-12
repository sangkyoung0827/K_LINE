import { NextResponse } from "next/server";
import { parseMetric, parsePage, parsePeriod, TraditionalLiquorAnalyticsService } from "@/lib/traditional-liquor/analytics";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  try {
    const params = new URL(request.url).searchParams;
    const results = await new TraditionalLiquorAnalyticsService().getSalesAnalytics({
      query: params.get("q") ?? "", platform: params.get("platform") ?? "",
      metric: parseMetric(params.get("metric")), period: parsePeriod(params.get("period")),
      page: parsePage(params.get("page")), limit: 50
    });
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Traditional liquor sales analytics error", error);
    return NextResponse.json({ error: "판매·인기도 분석 데이터를 불러오지 못했습니다.", debugCode: "TL_SALES_ANALYTICS_V1" }, { status: 500 });
  }
}
