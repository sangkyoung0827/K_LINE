import { NextResponse } from "next/server";
import { requireKnowledgeDeveloperApi } from "@/lib/knowledge/access";
import { searchKnowledge } from "@/lib/knowledge/search";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const guard = await requireKnowledgeDeveloperApi();
  if (guard.response) return guard.response;
  try {
    const body = (await request.json()) as { limit?: unknown; organization?: unknown; query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return NextResponse.json({ error: "검색어를 입력하세요." }, { status: 400 });
    const results = await searchKnowledge({
      limit: typeof body.limit === "number" ? body.limit : 10,
      organization: typeof body.organization === "string" ? body.organization.trim().slice(0, 100) : "",
      query
    });
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Knowledge search API failed", error);
    return NextResponse.json({ error: "우혁몬 DB 검색에 실패했습니다.", debugCode: "KNOWLEDGE_SEARCH_FAILED" }, { status: 500 });
  }
}
