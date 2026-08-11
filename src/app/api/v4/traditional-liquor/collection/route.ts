import { NextResponse } from "next/server";
import { FixtureCollectionAdapter } from "@/lib/traditional-liquor/collection/adapters";
import type { CollectionQueryType } from "@/lib/traditional-liquor/collection/types";
import { CollectionEngine, ImportPipeline } from "@/lib/traditional-liquor/import/pipeline";
import { SupabaseTraditionalLiquorImportRepository } from "@/lib/traditional-liquor/import/supabase-import-repository";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";
const queryTypes: CollectionQueryType[] = ["GENERAL", "CATEGORY", "PRODUCT", "BRAND", "BREWERY", "DISCOVERY"];

function safeError(error: unknown) {
  console.error("Traditional liquor collection error", error);
  return NextResponse.json({ error: "전통주 수집 작업을 처리하지 못했습니다.", debugCode: "TL_COLLECTION_V1" }, { status: 500 });
}

export async function GET(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  const repository = new SupabaseTraditionalLiquorImportRepository();
  const url = new URL(request.url);
  try {
    const resource = url.searchParams.get("resource") ?? "queries";
    if (resource === "queries") return NextResponse.json({ queries: await repository.list() });
    if (resource === "batches") return NextResponse.json({ batches: await repository.listBatches() });
    if (resource === "preview") {
      const batchId = url.searchParams.get("batchId")?.trim();
      if (!batchId) return NextResponse.json({ error: "batchId is required." }, { status: 400 });
      return NextResponse.json({ preview: await repository.getPreview(batchId) });
    }
    return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  const repository = new SupabaseTraditionalLiquorImportRepository();
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "create-query") {
      const query = typeof body.query === "string" ? body.query.trim().slice(0, 120) : "";
      const requestedType = typeof body.queryType === "string" ? body.queryType as CollectionQueryType : "DISCOVERY";
      const queryType = queryTypes.includes(requestedType) ? requestedType : "DISCOVERY";
      if (!query) return NextResponse.json({ error: "검색어를 입력하세요." }, { status: 400 });
      const created = await repository.create({ query, queryType, priority: Math.max(0, Math.min(1000, Number(body.priority ?? 50) || 50)), enabled: true });
      return NextResponse.json({ query: created }, { status: 201 });
    }
    if (body.action === "collect") {
      const queryId = typeof body.queryId === "string" ? body.queryId : "";
      const query = (await repository.list()).find((item) => item.id === queryId && item.enabled);
      if (!query) return NextResponse.json({ error: "활성화된 검색어를 선택하세요." }, { status: 400 });
      const engine = new CollectionEngine(new ImportPipeline(repository), [new FixtureCollectionAdapter()]);
      const result = await engine.collect("FIXTURE_BROWSER_V1", query);
      await repository.markCollected(query.id, new Date().toISOString());
      return NextResponse.json({ result }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const repository = new SupabaseTraditionalLiquorImportRepository();
    const query = await repository.update(id, { ...(typeof body.priority === "number" ? { priority: body.priority } : {}), ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}) });
    return NextResponse.json({ query });
  } catch (error) { return safeError(error); }
}
