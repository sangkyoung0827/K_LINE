import { NextResponse } from "next/server";
import { PostgreSQLTraditionalLiquorRepository } from "@/lib/traditional-liquor/postgresql-repository";
import { TraditionalLiquorDataService } from "@/lib/traditional-liquor/service";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  try {
    const query = new URL(request.url).searchParams.get("q")?.slice(0, 120) ?? "";
    return NextResponse.json(
      { results: await new TraditionalLiquorDataService(new PostgreSQLTraditionalLiquorRepository()).search(query) },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Traditional liquor market query error", error);
    return NextResponse.json({ error: "실제 전통주 Market DB를 불러오지 못했습니다.", debugCode: "TL_MARKET_V2" }, { status: 500 });
  }
}
