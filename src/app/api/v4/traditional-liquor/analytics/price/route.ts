import { NextResponse } from "next/server";
import { parseOptionalPrice, parsePage, parsePriceSort, TraditionalLiquorAnalyticsService } from "@/lib/traditional-liquor/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const results = await new TraditionalLiquorAnalyticsService().getPriceAnalytics({
      query: params.get("q") ?? "", platform: params.get("platform") ?? "",
      minPrice: parseOptionalPrice(params.get("min")), maxPrice: parseOptionalPrice(params.get("max")),
      sort: parsePriceSort(params.get("sort")), page: parsePage(params.get("page")), limit: 50
    });
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Traditional liquor price analytics error", error);
    return NextResponse.json({ error: "가격 분석 데이터를 불러오지 못했습니다.", debugCode: "TL_PRICE_ANALYTICS_V1" }, { status: 500 });
  }
}
