import { NextResponse } from "next/server";
import { suggestColumnMapping } from "@/lib/traditional-liquor/import/column-mapping";
import { parseImportFile, parseJsonBuffer } from "@/lib/traditional-liquor/import/file-parsers";
import { RealImportRepository } from "@/lib/traditional-liquor/import/real-import-repository";
import { fieldsForImportType, type ColumnMapping, type ParsedImportFile, type RealImportType } from "@/lib/traditional-liquor/import/real-import-types";
import { requireWoohyukmonV4DeveloperApi } from "@/lib/woohyukmon-v4-api";

export const dynamic = "force-dynamic";

function validImportType(value: unknown): value is RealImportType { return value === "PRODUCT_MASTER" || value === "MARKET_OFFER"; }
function safeError(error: unknown) {
  console.error("Traditional liquor real import error", error);
  const known = error instanceof Error && /^(MANUAL_REVIEW_REQUIRED|BATCH_NOT_READY|BATCH_DISCARDED|IMPORT_BATCH_NOT_FOUND|NOT_A_REAL_IMPORT_BATCH|NO_COMMITTABLE_ROWS|STAGING_ROW_NOT_FOUND|PRODUCT_LINK_REQUIRED|SELLER_LINK_REQUIRED|PLATFORM_LINK_REQUIRED|IMPORTING_BATCH_CANNOT_BE_DISCARDED|BATCH_MUST_BE_DISCARDED_FIRST|COMMITTED_BATCH_CANNOT_BE_DELETED)/.test(error.message);
  const message = known ? (error as Error).message : "실제 전통주 Import 작업을 처리하지 못했습니다.";
  return NextResponse.json({ error: message, debugCode: "TL_REAL_IMPORT_V2" }, { status: known ? 409 : 500 });
}

function safeMapping(value: string | null, parsed: ParsedImportFile) {
  if (!value) return suggestColumnMapping(parsed.headers, parsed.importType);
  const decoded = JSON.parse(value) as ColumnMapping;
  const allowed = new Set(fieldsForImportType(parsed.importType));
  return Object.fromEntries(Object.entries(decoded).filter(([header, field]) => parsed.headers.includes(header) && allowed.has(field as never)));
}

export async function GET(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  const url = new URL(request.url);
  const repository = new RealImportRepository();
  try {
    if ((url.searchParams.get("resource") ?? "batches") === "batches") return NextResponse.json({ batches: await repository.listRealBatches() });
    if (url.searchParams.get("resource") === "rows") {
      const batchId = url.searchParams.get("batchId")?.trim();
      if (!batchId) return NextResponse.json({ error: "batchId is required." }, { status: 400 });
      return NextResponse.json({ rows: await repository.getRows(batchId) });
    }
    return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  const repository = new RealImportRepository();
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const importType = form.get("importType");
      const action = String(form.get("action") ?? "analyze");
      const sourceName = String(form.get("sourceName") ?? "직접 조사").trim().slice(0, 160);
      const sheetName = form.get("sheetName")?.toString() || undefined;
      if (!(file instanceof File) || !validImportType(importType)) return NextResponse.json({ error: "파일과 데이터 유형이 필요합니다." }, { status: 400 });
      const parsed = await parseImportFile(file, importType, sourceName, { sheetName });
      const suggestedMapping = suggestColumnMapping(parsed.headers, parsed.importType);
      if (action === "analyze") return NextResponse.json({ analysis: {
        fileType: parsed.fileType, fileName: parsed.fileName, importType: parsed.importType,
        requestedImportType: parsed.requestedImportType, detectedImportType: parsed.detectedImportType,
        hasTypeConflict: parsed.hasTypeConflict, typeOverrideApplied: parsed.typeOverrideApplied,
        detectionConfidence: parsed.detectionConfidence, detectionReasons: parsed.detectionReasons,
        sheetName: parsed.sheetName, sheetNames: parsed.sheetNames, headers: parsed.headers,
        suggestedMapping, sampleRows: parsed.records.slice(0, 10).map((item) => item.rawData), totalRows: parsed.records.length
      } });
      if (action === "stage") {
        if (parsed.hasTypeConflict) return NextResponse.json({ error: `파일 형식이 ${parsed.detectedImportType}로 감지되었습니다. 감지된 데이터 유형으로 다시 분석하세요.`, debugCode: "TL_IMPORT_TYPE_CONFLICT" }, { status: 409 });
        const mapping = safeMapping(form.get("mapping")?.toString() ?? null, parsed);
        const result = await repository.stageFile(parsed, mapping, sourceName, form.get("observedAt")?.toString() || null);
        return NextResponse.json({ result }, { status: 201 });
      }
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const body = await request.json() as Record<string, unknown>;
    if (body.action === "resolve" && typeof body.batchId === "string") return NextResponse.json({ result: await repository.resolveBatch(body.batchId) });
    if (body.action === "commit" && typeof body.batchId === "string") return NextResponse.json({ result: await repository.commitBatch(body.batchId) });
    if (body.action === "discard" && typeof body.batchId === "string") return NextResponse.json({ result: await repository.discardBatch(body.batchId, typeof body.reason === "string" ? body.reason : null) });
    if (body.action === "permanently-delete" && typeof body.batchId === "string") return NextResponse.json({ result: await repository.permanentlyDeleteBatch(body.batchId) });
    if (body.action === "stage-json" && validImportType(body.importType) && Array.isArray(body.records)) {
      const sourceName = typeof body.sourceName === "string" ? body.sourceName.slice(0, 160) : "JSON API";
      const parsed = parseJsonBuffer(Buffer.from(JSON.stringify(body.records)), typeof body.fileName === "string" ? body.fileName : "collector-import.json", body.importType, sourceName);
      const mapping = body.mapping && typeof body.mapping === "object" ? body.mapping as ColumnMapping : suggestColumnMapping(parsed.headers, parsed.importType);
      return NextResponse.json({ result: await repository.stageFile(parsed, mapping, sourceName, typeof body.observedAt === "string" ? body.observedAt : null) }, { status: 201 });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  const access = await requireWoohyukmonV4DeveloperApi();
  if (access instanceof NextResponse) return access;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body.action;
    if (typeof body.rowId !== "string" || !["LINK_EXISTING", "CREATE_NEW", "EXCLUDE"].includes(String(action))) return NextResponse.json({ error: "Valid row review action is required." }, { status: 400 });
    const repository = new RealImportRepository();
    await repository.reviewRow(body.rowId, action as "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", { productId: typeof body.productId === "string" ? body.productId : null, sellerId: typeof body.sellerId === "string" ? body.sellerId : null, platformId: typeof body.platformId === "string" ? body.platformId : null, breweryId: typeof body.breweryId === "string" ? body.breweryId : null });
    return NextResponse.json({ ok: true });
  } catch (error) { return safeError(error); }
}
