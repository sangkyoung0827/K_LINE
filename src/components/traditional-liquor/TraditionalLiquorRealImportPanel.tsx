"use client";

import { AlertTriangle, CheckCircle2, CircleSlash2, Download, ExternalLink, FileSearch, Link2, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CommitResult, RealStagingRow, ResolutionResult } from "@/lib/traditional-liquor/import/real-import-repository";
import { createImportPreview, formatPreviewPrice } from "@/lib/traditional-liquor/import/import-preview";
import { fieldsForImportType, type ColumnMapping, type RealImportAnalysis, type RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

const endpoint = "/api/v4/traditional-liquor/import";
type Batch = { id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; inserted_rows: number; updated_rows: number; skipped_rows: number; file_name: string | null; import_type: RealImportType | null; created_at: string; discarded_at?: string | null; discard_reason?: string | null; production_committed_at?: string | null };
type Platform = { id: string; code: string; name: string };
type BatchFilter = "ACTIVE" | "COMPLETED" | "DISCARDED";

async function jsonRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "요청을 처리하지 못했습니다.");
  return body;
}

export function TraditionalLiquorRealImportPanel() {
  const [importType, setImportType] = useState<RealImportType>("PRODUCT_MASTER");
  const [file, setFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [analysis, setAnalysis] = useState<RealImportAnalysis | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<RealStagingRow[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [resolution, setResolution] = useState<ResolutionResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [batchFilter, setBatchFilter] = useState<BatchFilter>("ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadBatches = useCallback(async () => {
    try { setBatches((await jsonRequest<{ batches: Batch[] }>(`${endpoint}?resource=batches`)).batches); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Import Batch를 불러오지 못했습니다."); }
  }, []);
  useEffect(() => { void loadBatches(); }, [loadBatches]);
  useEffect(() => {
    void jsonRequest<{ platforms: Platform[] }>(`${endpoint}?resource=platforms`)
      .then((body) => setPlatforms(body.platforms))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "플랫폼을 불러오지 못했습니다."));
  }, []);

  function formData(action: "analyze" | "stage", requestedType: RealImportType) {
    if (!file) throw new Error("CSV, XLSX 또는 JSON 파일을 선택하세요.");
    if (!sourceName.trim()) throw new Error("Source 이름을 입력하세요.");
    const form = new FormData();
    form.set("action", action); form.set("file", file); form.set("importType", requestedType); form.set("sourceName", sourceName.trim());
    if (observedAt) form.set("observedAt", new Date(observedAt).toISOString());
    if (action === "stage") form.set("mapping", JSON.stringify(mapping));
    return form;
  }

  async function analyzeFile(requestedType: RealImportType = importType) {
    setBusy(true); setAnalysis(null); setError(""); setCommitResult(null);
    try { const body = await jsonRequest<{ analysis: RealImportAnalysis }>(endpoint, { method: "POST", body: formData("analyze", requestedType) }); setAnalysis(body.analysis); setMapping(body.analysis.suggestedMapping); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "파일을 분석하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function stageFile() {
    setBusy(true); setError("");
    try {
      if (!analysis || analysis.hasTypeConflict) throw new Error("파일 형식 충돌을 먼저 확인하세요.");
      const body = await jsonRequest<{ result: { batchId: string } }>(endpoint, { method: "POST", body: formData("stage", analysis.importType) });
      await loadBatches(); await openBatch(body.result.batchId); setAnalysis(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Staging 저장에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function openBatch(batchId: string) {
    const batchBody = await jsonRequest<{ batches: Batch[] }>(`${endpoint}?resource=batches`);
    const batch = batchBody.batches.find((item) => item.id === batchId) ?? null;
    const rowBody = await jsonRequest<{ rows: RealStagingRow[] }>(`${endpoint}?resource=rows&batchId=${encodeURIComponent(batchId)}`);
    setBatches(batchBody.batches); setSelectedBatch(batch); setRows(rowBody.rows); setResolution(null); setCommitResult(null);
  }

  async function resolve() {
    if (!selectedBatch) return;
    setBusy(true); setError("");
    try { const body = await jsonRequest<{ result: ResolutionResult }>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", batchId: selectedBatch.id }) }); await openBatch(selectedBatch.id); setResolution(body.result); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Entity Resolution에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function review(row: RealStagingRow, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids: Record<string, string> = {}) {
    setBusy(true);
    try {
      await jsonRequest(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowId: row.id, action, ...ids }) });
      if (selectedBatch) await openBatch(selectedBatch.id);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "검토 결과를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function assignPlatform(platformId: string) {
    if (!selectedBatch || !platformId) return;
    setBusy(true); setError("");
    try {
      await jsonRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign-platform", batchId: selectedBatch.id, platformId }) });
      await openBatch(selectedBatch.id);
      const body = await jsonRequest<{ result: ResolutionResult }>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", batchId: selectedBatch.id }) });
      await openBatch(selectedBatch.id); setResolution(body.result);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "플랫폼 일괄 지정에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!selectedBatch) return;
    setBusy(true); setError(""); setConfirmOpen(false);
    try { const body = await jsonRequest<{ result: CommitResult }>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit", batchId: selectedBatch.id }) }); await loadBatches(); await openBatch(selectedBatch.id); setCommitResult(body.result); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Production 반영에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function discard(reason: string) {
    if (!selectedBatch) return;
    setBusy(true); setError("");
    try {
      await jsonRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard", batchId: selectedBatch.id, reason }) });
      setDiscardOpen(false); setBatchFilter("DISCARDED"); await openBatch(selectedBatch.id);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Batch 폐기에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function permanentlyDelete() {
    if (!selectedBatch) return;
    setBusy(true); setError("");
    try {
      await jsonRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "permanently-delete", batchId: selectedBatch.id }) });
      setDeleteOpen(false); setSelectedBatch(null); setRows([]); setResolution(null); await loadBatches();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Batch 완전 삭제에 실패했습니다."); }
    finally { setBusy(false); }
  }

  const reviewCount = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "MANUAL_REVIEW").length;
  const unresolvedCount = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "UNRESOLVED").length;
  const committable = !!selectedBatch && selectedBatch.status === "READY" && rows.some((row) => row.validation_status === "VALID" && row.review_action !== "EXCLUDE") && reviewCount === 0 && unresolvedCount === 0;
  const filteredBatches = batches.filter((batch) => batchFilter === "ACTIVE" ? !["COMPLETED", "DISCARDED"].includes(batch.status) : batch.status === batchFilter);

  return <section className="mt-6 border border-white/10 bg-white/[0.025]">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
      <div><div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#f7c76b]"><Upload className="h-4 w-4" />REAL DATA IMPORT V2</div><h2 className="mt-2 text-xl font-semibold">전통주 실제 데이터 가져오기</h2><p className="mt-1 text-xs leading-5 text-white/42">CSV · XLSX · JSON (최대 4MB / 10,000행) → Staging → Entity Resolution → 관리자 승인 → Production</p></div>
      <div className="flex gap-2"><a href="/templates/traditional_liquor_product_master_template.csv" download className="inline-flex h-9 items-center gap-2 border border-white/12 px-3 text-[10px] font-bold text-white/55 hover:text-white"><Download className="h-3.5 w-3.5" />Master Template</a><a href="/templates/traditional_liquor_market_offer_template.csv" download className="inline-flex h-9 items-center gap-2 border border-white/12 px-3 text-[10px] font-bold text-white/55 hover:text-white"><Download className="h-3.5 w-3.5" />Offer Template</a></div>
    </header>
    {error ? <div className="flex gap-2 border-b border-red-300/20 bg-red-300/7 px-5 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div> : null}

    <div className="grid gap-5 border-b border-white/10 p-5 lg:grid-cols-2">
      <div><p className="text-xs font-bold text-white/65">데이터 유형</p><div className="mt-2 grid grid-cols-2 gap-2"><TypeButton active={importType === "PRODUCT_MASTER"} onClick={() => { setImportType("PRODUCT_MASTER"); setAnalysis(null); }}>제품 / 양조장 Master</TypeButton><TypeButton active={importType === "MARKET_OFFER"} onClick={() => { setImportType("MARKET_OFFER"); setAnalysis(null); }}>시장 판매정보 Offer</TypeButton></div></div>
      <label className="block"><span className="text-xs font-bold text-white/65">파일</span><input type="file" accept=".csv,.xlsx,.json" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setAnalysis(null); }} className="mt-2 block h-10 w-full border border-white/15 bg-[#0e1112] px-3 py-2 text-xs text-white/65 file:mr-3 file:border-0 file:bg-[#f7c76b] file:px-2 file:py-1 file:text-[10px] file:font-bold" /></label>
      <label className="block"><span className="text-xs font-bold text-white/65">Source 이름</span><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="직접 조사, aT, 공식 양조장 자료" className="mt-2 h-10 w-full border border-white/15 bg-[#0e1112] px-3 text-sm text-white outline-none focus:border-[#f7c76b]" /></label>
      <label className="block"><span className="text-xs font-bold text-white/65">기준 / 수집일</span><input type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="mt-2 h-10 w-full border border-white/15 bg-[#0e1112] px-3 text-sm text-white/70 outline-none" /></label>
      <button type="button" onClick={() => void analyzeFile()} disabled={busy || !file || !sourceName.trim()} className="inline-flex h-11 items-center justify-center gap-2 bg-[#f7c76b] text-sm font-bold text-[#17191a] disabled:opacity-40 lg:col-span-2">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}파일 분석</button>
    </div>

    {analysis ? <MappingEditor analysis={analysis} mapping={mapping} onChange={setMapping} onStage={() => void stageFile()} onUseDetected={() => {
      if (!analysis.detectedImportType) return;
      setImportType(analysis.detectedImportType);
      void analyzeFile(analysis.detectedImportType);
    }} busy={busy} /> : null}
    <div className="grid lg:grid-cols-[280px_1fr]">
      <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r"><p className="px-1 text-xs font-bold text-white/55">실제 Import Batch</p><div className="mt-3 grid grid-cols-3 gap-1">{(["ACTIVE", "COMPLETED", "DISCARDED"] as BatchFilter[]).map((filter) => <button key={filter} type="button" onClick={() => { setBatchFilter(filter); setSelectedBatch(null); setRows([]); }} className={`h-8 border text-[9px] font-bold ${batchFilter === filter ? "border-[#f7c76b] bg-[#f7c76b]/10 text-[#f7c76b]" : "border-white/10 text-white/38"}`}>{filter === "ACTIVE" ? "활성" : filter === "COMPLETED" ? "Production 완료" : "폐기됨"}</button>)}</div><div className="mt-3 max-h-[520px] space-y-2 overflow-auto">{filteredBatches.length ? filteredBatches.map((batch) => <button key={batch.id} type="button" onClick={() => void openBatch(batch.id)} className={`w-full border p-3 text-left ${selectedBatch?.id === batch.id ? "border-[#f7c76b] bg-[#f7c76b]/7" : "border-white/10 bg-black/10"}`}><div className="flex justify-between gap-2"><span className="truncate text-xs font-bold text-white/75">{batch.file_name}</span><span className="text-[9px] font-bold text-[#f7c76b]">{batch.status}</span></div><p className="mt-1 text-[10px] text-white/34">{batch.import_type} · {batch.total_rows}행 · 오류 {batch.invalid_rows}</p></button>) : <p className="px-1 py-6 text-center text-[10px] text-white/28">해당 Batch가 없습니다.</p>}</div></div>
      <div className="min-w-0 p-5">{selectedBatch ? <BatchWorkspace batch={selectedBatch} rows={rows} platforms={platforms} resolution={resolution} busy={busy} committable={committable} onResolve={() => void resolve()} onAssignPlatform={(platformId) => void assignPlatform(platformId)} onReview={review} onCommit={() => setConfirmOpen(true)} onDiscard={() => setDiscardOpen(true)} onDelete={() => setDeleteOpen(true)} /> : <div className="grid min-h-48 place-items-center text-sm text-white/32">분석할 실제 Import Batch를 선택하세요.</div>}</div>
    </div>
    {commitResult ? <div className="border-t border-emerald-300/20 bg-emerald-300/7 p-5"><div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" />Production 반영 완료</div><p className="mt-2 text-xs text-white/55">Products +{commitResult.productsInserted} / Updated {commitResult.productsUpdated} · Breweries +{commitResult.breweriesInserted} · Sellers +{commitResult.sellersInserted} · Offers +{commitResult.offersInserted} / Updated {commitResult.offersUpdated} · History +{commitResult.priceHistoryInserted}</p></div> : null}
    {confirmOpen && selectedBatch ? <CommitModal batch={selectedBatch} rows={rows} onCancel={() => setConfirmOpen(false)} onConfirm={() => void commit()} /> : null}
    {discardOpen && selectedBatch ? <DiscardModal batch={selectedBatch} busy={busy} onCancel={() => setDiscardOpen(false)} onConfirm={(reason) => void discard(reason)} /> : null}
    {deleteOpen && selectedBatch ? <DeleteBatchModal batch={selectedBatch} busy={busy} onCancel={() => setDeleteOpen(false)} onConfirm={() => void permanentlyDelete()} /> : null}
  </section>;
}

function TypeButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-3 text-xs font-bold ${active ? "border-[#f7c76b] bg-[#f7c76b]/12 text-[#f7c76b]" : "border-white/12 text-white/48"}`}>{children}</button>; }

function MappingEditor({ analysis, mapping, onChange, onStage, onUseDetected, busy }: { analysis: RealImportAnalysis; mapping: ColumnMapping; onChange: (mapping: ColumnMapping) => void; onStage: () => void; onUseDetected: () => void; busy: boolean }) {
  const fields = fieldsForImportType(analysis.importType);
  const previews = analysis.sampleRows.map((row) => createImportPreview(analysis.importType, {}, row, mapping));
  return <div className="border-b border-white/10 p-5">
    {analysis.hasTypeConflict && analysis.detectedImportType ? <div className="mb-5 border border-amber-300/30 bg-amber-300/8 p-4"><div className="flex gap-2 text-sm font-bold text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />업로드한 파일은 {analysis.detectedImportType === "MARKET_OFFER" ? "시장 판매정보 Offer" : "제품 / 양조장 Master"} 형식으로 감지되었습니다.</div><p className="mt-2 text-xs text-white/45">잘못된 유형으로 Production 데이터가 생성되지 않도록 감지된 형식으로만 진행할 수 있습니다. 선택: {analysis.requestedImportType} · 감지: {analysis.detectedImportType} · 신뢰도: {analysis.detectionConfidence}{analysis.sheetName ? ` · 시트: ${analysis.sheetName}` : ""}</p><div className="mt-3"><button type="button" onClick={onUseDetected} disabled={busy} className="h-9 bg-[#f7c76b] px-4 text-[11px] font-bold text-[#17191a]">{analysis.detectedImportType}로 변경</button></div></div> : null}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-bold">Column Mapping</h3><p className="mt-1 text-xs text-white/38">{analysis.fileName} · {analysis.importType} · {analysis.totalRows}행 · {analysis.fileType}{analysis.sheetName ? ` · ${analysis.sheetName} 시트` : ""}</p></div><button type="button" onClick={onStage} disabled={busy || analysis.hasTypeConflict || Object.keys(mapping).length === 0} className="h-10 bg-[#f7c76b] px-5 text-xs font-bold text-[#17191a] disabled:opacity-40">Staging에 저장</button></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2">{analysis.headers.map((header) => <label key={header} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border border-white/8 bg-black/10 p-2"><span className="truncate text-xs text-white/55">{header}</span><select value={mapping[header] ?? ""} onChange={(event) => onChange({ ...mapping, [header]: event.target.value })} className="h-8 min-w-0 border border-white/12 bg-[#0e1112] px-2 text-[11px] text-white"><option value="">사용 안 함</option>{fields.map((field) => <option key={field} value={field}>{field}</option>)}</select></label>)}</div>
    <h4 className="mt-5 text-xs font-bold text-white/60">Preview · 첫 {previews.length}행</h4>
    <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-[11px]"><thead className="border-y border-white/10 text-white/35"><tr><th className="px-2 py-2">상품 / Listing</th><th className="px-2 py-2">{analysis.importType === "MARKET_OFFER" ? "판매업체" : "양조장"}</th>{analysis.importType === "MARKET_OFFER" ? <><th className="px-2 py-2">가격</th><th className="px-2 py-2">플랫폼</th><th className="px-2 py-2">용량 × 수량</th><th className="px-2 py-2">URL</th></> : <th className="px-2 py-2">용량</th>}</tr></thead><tbody>{previews.map((preview, index) => <tr key={index} className="border-b border-white/8"><td className="max-w-72 truncate px-2 py-2 font-semibold text-white/72">{String(preview.title ?? "-")}</td><td className="px-2 py-2 text-white/50">{String(preview.seller ?? "-")}</td>{analysis.importType === "MARKET_OFFER" ? <><td className="px-2 py-2 text-[#f7c76b]">{formatPreviewPrice(preview.price)}</td><td className="px-2 py-2 text-white/50">{String(preview.platform ?? "-")}</td><td className="px-2 py-2 text-white/50">{preview.volumeMl ? `${preview.volumeMl}ml` : "-"} × {String(preview.quantity ?? "-")}</td><td className="px-2 py-2">{preview.listingUrl ? <a href={String(preview.listingUrl)} target="_blank" rel="noreferrer" title="판매 URL 열기" className="text-[#f7c76b]"><ExternalLink className="h-3.5 w-3.5" /></a> : "-"}</td></> : <td className="px-2 py-2 text-white/50">{preview.volumeMl ? `${preview.volumeMl}ml` : "-"}</td>}</tr>)}</tbody></table></div>
  </div>;
}

function BatchWorkspace({ batch, rows, platforms, resolution, busy, committable, onResolve, onAssignPlatform, onReview, onCommit, onDiscard, onDelete }: { batch: Batch; rows: RealStagingRow[]; platforms: Platform[]; resolution: ResolutionResult | null; busy: boolean; committable: boolean; onResolve: () => void; onAssignPlatform: (platformId: string) => void; onReview: (row: RealStagingRow, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids?: Record<string, string>) => void; onCommit: () => void; onDiscard: () => void; onDelete: () => void }) {
  const importType = batch.import_type ?? "MARKET_OFFER";
  const deleteAllowed = batch.status === "DISCARDED" && !batch.production_committed_at;
  const unresolved = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "UNRESOLVED").length;
  const reviewRows = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "MANUAL_REVIEW");
  const blockingReasons = Object.entries(reviewRows.reduce<Record<string, number>>((counts, row) => {
    const reasons = Array.isArray(row.resolution_data?.reasons) ? row.resolution_data.reasons : [];
    for (const reason of reasons) counts[String(reason)] = (counts[String(reason)] ?? 0) + 1;
    return counts;
  }, {}));
  const unknownPlatformRows = reviewRows.filter((row) => Array.isArray(row.resolution_data?.reasons) && row.resolution_data.reasons.includes("UNKNOWN_PLATFORM")).length;
  const validRows = rows.filter((row) => row.validation_status === "VALID").length;
  const commitHint = batch.status !== "READY"
    ? "READY 상태의 Batch만 반영할 수 있습니다."
    : unresolved
      ? `Entity Resolution이 필요한 행이 ${unresolved}개 있습니다.`
      : reviewRows.length
        ? `수동 검토가 필요한 행이 ${reviewRows.length}개 있습니다.`
        : "Production DB에 반영";
  return <><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">{batch.file_name}</h3><p className="mt-1 text-xs text-white/35">총 {batch.total_rows} · VALID {batch.valid_rows} · INVALID {batch.invalid_rows} · {batch.status === "READY" ? "READY (검증 완료 / 반영 전)" : batch.status === "COMPLETED" ? "COMPLETED (Production 반영 완료)" : batch.status === "DISCARDED" ? "DISCARDED (폐기됨)" : batch.status}</p>{batch.status === "DISCARDED" ? <p className="mt-2 text-xs text-red-200/70">폐기 사유: {batch.discard_reason || "기록 없음"}{batch.production_committed_at ? " · Production 반영 이력 있음" : ""}</p> : null}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={onDiscard} disabled={busy || ["DISCARDED", "IMPORTING"].includes(batch.status)} className="inline-flex h-9 items-center gap-1.5 border border-red-300/25 px-3 text-[10px] font-bold text-red-200 disabled:opacity-30"><CircleSlash2 className="h-3.5 w-3.5" />폐기</button><button type="button" onClick={onDelete} disabled={busy || !deleteAllowed} title={batch.production_committed_at ? "Production 반영 이력이 있는 Batch는 삭제할 수 없습니다." : batch.status !== "DISCARDED" ? "먼저 Batch를 폐기하세요." : "Batch 완전 삭제"} className="inline-flex h-9 items-center gap-1.5 border border-red-300/25 px-3 text-[10px] font-bold text-red-200 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" />완전 삭제</button><button type="button" onClick={onResolve} disabled={busy || batch.status !== "READY"} className="h-9 border border-[#f7c76b]/50 px-3 text-[10px] font-bold text-[#f7c76b] disabled:opacity-35">Entity Resolution 실행</button><button type="button" onClick={onCommit} disabled={busy || !committable || batch.status === "DISCARDED"} title={commitHint} className="h-9 bg-[#f7c76b] px-3 text-[10px] font-bold text-[#17191a] disabled:opacity-35">Production DB에 반영</button></div></div>
    {resolution ? <p className="mt-3 text-xs text-white/48">MATCHED {resolution.matched} · NEW {resolution.newEntity} · REVIEW {resolution.manualReview} · INVALID {resolution.invalid}</p> : null}
    {!committable && batch.status === "READY" ? <div className="mt-3 border border-amber-300/20 bg-amber-300/7 px-3 py-2 text-xs text-amber-100"><strong>반영 대기:</strong> {commitHint}{blockingReasons.length ? ` 차단 사유: ${blockingReasons.map(([reason, count]) => `${reason} ${count}개`).join(", ")}` : ""}</div> : null}
    {unknownPlatformRows > 0 ? <BatchPlatformAssignment platforms={platforms} rowCount={validRows} busy={busy} onAssign={onAssignPlatform} /> : null}
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1100px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/35"><tr><th className="px-3 py-2">행</th><th className="px-3 py-2">제품 / Listing</th><th className="px-3 py-2">{importType === "MARKET_OFFER" ? "판매업체" : "양조장"}</th>{importType === "MARKET_OFFER" ? <><th className="px-3 py-2">가격</th><th className="px-3 py-2">플랫폼</th><th className="px-3 py-2">용량 × 수량</th><th className="px-3 py-2">URL</th></> : null}<th className="px-3 py-2">Validation</th><th className="px-3 py-2">Resolution</th><th className="px-3 py-2">검토</th></tr></thead><tbody>{rows.map((row) => { const preview = createImportPreview(importType, row.normalized_data, row.raw_data); return <tr key={row.id} className="border-b border-white/8"><td className="px-3 py-3 text-white/30">{row.row_number}</td><td className="max-w-64 truncate px-3 py-3 font-semibold text-white/75">{String(preview.title ?? "-")}</td><td className="px-3 py-3 text-white/48">{String(preview.seller ?? "-")}</td>{importType === "MARKET_OFFER" ? <><td className="px-3 py-3 text-[#f7c76b]">{formatPreviewPrice(preview.price)}</td><td className="px-3 py-3 text-white/48">{String(preview.platform ?? "-")}</td><td className="px-3 py-3 text-white/48">{preview.volumeMl ? `${preview.volumeMl}ml` : "-"} × {String(preview.quantity ?? "-")}</td><td className="px-3 py-3">{preview.listingUrl ? <a href={String(preview.listingUrl)} target="_blank" rel="noreferrer" title="판매 URL 열기" className="text-[#f7c76b]"><ExternalLink className="h-3.5 w-3.5" /></a> : "-"}</td></> : null}<td className={row.validation_status === "VALID" ? "px-3 py-3 text-emerald-300" : "px-3 py-3 text-red-300"}>{row.validation_status}</td><td className={`px-3 py-3 font-bold ${row.resolution_status === "MANUAL_REVIEW" ? "text-red-300" : row.resolution_status === "NEW_ENTITY" ? "text-[#f7c76b]" : "text-white/55"}`}>{row.review_action === "EXCLUDE" ? "EXCLUDED" : row.resolution_status}</td><td className="px-3 py-3">{row.resolution_status === "MANUAL_REVIEW" ? <ReviewActions row={row} onReview={onReview} /> : "-"}</td></tr>; })}</tbody></table></div></>;
}

function BatchPlatformAssignment({ platforms, rowCount, busy, onAssign }: { platforms: Platform[]; rowCount: number; busy: boolean; onAssign: (platformId: string) => void }) {
  const [platformId, setPlatformId] = useState(platforms.find((platform) => platform.code === "KAKAO_GIFT")?.id ?? platforms[0]?.id ?? "");
  useEffect(() => {
    if (!platformId && platforms.length) setPlatformId(platforms.find((platform) => platform.code === "KAKAO_GIFT")?.id ?? platforms[0].id);
  }, [platformId, platforms]);
  return <div className="mt-3 flex flex-wrap items-end gap-2 border border-[#f7c76b]/25 bg-[#f7c76b]/7 p-3"><label className="min-w-56 flex-1"><span className="text-[10px] font-bold text-[#f7c76b]">플랫폼 일괄 지정</span><select value={platformId} onChange={(event) => setPlatformId(event.target.value)} className="mt-1 h-9 w-full border border-white/15 bg-[#0e1112] px-2 text-xs text-white"><option value="">플랫폼 선택</option>{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name} ({platform.code})</option>)}</select></label><button type="button" disabled={busy || !platformId} onClick={() => onAssign(platformId)} className="h-9 bg-[#f7c76b] px-4 text-[10px] font-bold text-[#17191a] disabled:opacity-35">{rowCount}개 행 전체 적용</button></div>;
}

function ReviewActions({ row, onReview }: { row: RealStagingRow; onReview: (row: RealStagingRow, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids?: Record<string, string>) => void }) {
  const candidates = (row.resolution_data?.candidates ?? {}) as Record<string, Array<{ id: string; name: string }>>;
  const [ids, setIds] = useState<Record<string, string>>({ productId: candidates.products?.[0]?.id ?? "", sellerId: candidates.sellers?.[0]?.id ?? "", platformId: candidates.platforms?.[0]?.id ?? "", breweryId: candidates.breweries?.[0]?.id ?? "" });
  const groups = [["products", "productId", "제품"], ["sellers", "sellerId", "업체"], ["platforms", "platformId", "플랫폼"], ["breweries", "breweryId", "양조장"]] as const;
  return <div className="min-w-56 space-y-1.5">{groups.filter(([group]) => candidates[group]?.length).map(([group, key, label]) => <select key={group} aria-label={`${label} 후보`} value={ids[key]} onChange={(event) => setIds({ ...ids, [key]: event.target.value })} className="h-7 w-full border border-white/12 bg-[#0e1112] px-2 text-[9px] text-white/65"><option value="">{label} 선택</option>{candidates[group].map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>)}<div className="flex gap-1"><button type="button" onClick={() => onReview(row, "LINK_EXISTING", ids)} className="h-7 border border-white/15 px-2 text-[9px] text-white/60"><Link2 className="mr-1 inline h-3 w-3" />기존 연결</button><button type="button" onClick={() => onReview(row, "CREATE_NEW", ids)} className="h-7 border border-white/15 px-2 text-[9px] text-white/60">신규 생성</button><button type="button" onClick={() => onReview(row, "EXCLUDE")} className="h-7 border border-red-300/20 px-2 text-[9px] text-red-200">제외</button></div></div>;
}

function DiscardModal({ batch, busy, onCancel, onConfirm }: { batch: Batch; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5"><div role="dialog" aria-modal="true" aria-labelledby="discard-title" className="w-full max-w-md border border-red-300/20 bg-[#17191a] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-red-200">AUDIT-PRESERVING ACTION</p><h3 id="discard-title" className="mt-2 text-xl font-bold">이 Batch를 폐기하시겠습니까?</h3></div><button type="button" onClick={onCancel} title="닫기" className="grid h-8 w-8 place-items-center text-white/50"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-6 text-white/60">Staging 데이터는 Production 반영 대상에서 제외됩니다.<br />이미 존재하는 Production DB 데이터에는 영향을 주지 않습니다.</p>{batch.production_committed_at || batch.status === "COMPLETED" ? <p className="mt-3 border border-amber-300/20 bg-amber-300/7 p-3 text-xs leading-5 text-amber-100">이 Batch에는 Production 반영 이력이 있습니다. 폐기 기록은 남지만 기존 Production 데이터는 유지되며 완전 삭제는 허용되지 않습니다.</p> : null}<label className="mt-4 block"><span className="text-xs font-bold text-white/55">폐기 사유</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="잘못된 Import Type, 테스트 Batch 등" className="mt-2 min-h-24 w-full resize-y border border-white/15 bg-[#0e1112] p-3 text-sm text-white outline-none focus:border-red-300/50" /></label><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} disabled={busy} className="h-11 border border-white/15 text-xs font-bold text-white/60">취소</button><button type="button" onClick={() => onConfirm(reason)} disabled={busy || !reason.trim()} className="h-11 bg-red-200 text-xs font-bold text-[#17191a] disabled:opacity-35">폐기 처리</button></div></div></div>;
}

function DeleteBatchModal({ batch, busy, onCancel, onConfirm }: { batch: Batch; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-5"><div role="dialog" aria-modal="true" aria-labelledby="delete-batch-title" className="w-full max-w-md border border-red-300/25 bg-[#17191a] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-red-200">DEVELOPER-ONLY DESTRUCTIVE ACTION</p><h3 id="delete-batch-title" className="mt-2 text-xl font-bold">Import Batch 완전 삭제</h3></div><button type="button" onClick={onCancel} title="닫기" className="grid h-8 w-8 place-items-center text-white/50"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm leading-6 text-white/60">이 Batch와 종속 Staging, Error, 임시 Resolution 데이터가 영구 삭제됩니다. Products, Breweries, Sellers, Offers, Price History는 삭제하지 않습니다.</p><p className="mt-3 truncate border border-white/10 p-3 text-xs text-white/40">{batch.file_name}</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} disabled={busy} className="h-11 border border-white/15 text-xs font-bold text-white/60">취소</button><button type="button" onClick={onConfirm} disabled={busy} className="h-11 bg-red-200 text-xs font-bold text-[#17191a] disabled:opacity-35">완전 삭제</button></div></div></div>;
}

function CommitModal({ batch, rows, onCancel, onConfirm }: { batch: Batch; rows: RealStagingRow[]; onCancel: () => void; onConfirm: () => void }) {
  const excluded = rows.filter((row) => row.review_action === "EXCLUDE" || row.validation_status === "INVALID").length;
  const newRows = rows.filter((row) => row.resolution_status === "NEW_ENTITY" && row.review_action !== "EXCLUDE").length;
  const matched = rows.filter((row) => row.resolution_status === "MATCHED" && row.review_action !== "EXCLUDE").length;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5"><div role="dialog" aria-modal="true" aria-labelledby="commit-title" className="w-full max-w-md border border-white/15 bg-[#17191a] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-[#f7c76b]">IRREVERSIBLE PRODUCTION ACTION</p><h3 id="commit-title" className="mt-2 text-xl font-bold">실제 DB 반영</h3></div><button type="button" onClick={onCancel} title="닫기" className="grid h-8 w-8 place-items-center text-white/50"><X className="h-4 w-4" /></button></div><dl className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-xs"><dt className="text-white/40">신규 예상 행</dt><dd className="text-right font-bold text-[#f7c76b]">{newRows}</dd><dt className="text-white/40">기존 연결 행</dt><dd className="text-right font-bold">{matched}</dd><dt className="text-white/40">제외 / Invalid</dt><dd className="text-right font-bold">{excluded}</dd><dt className="text-white/40">Batch</dt><dd className="truncate text-right text-white/45">{batch.id}</dd></dl><p className="mt-4 text-xs leading-5 text-white/45">제품, 양조장, 업체, Offer와 Price History를 하나의 DB 트랜잭션으로 반영합니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="h-11 border border-white/15 text-xs font-bold text-white/60">취소</button><button type="button" onClick={onConfirm} className="h-11 bg-[#f7c76b] text-xs font-bold text-[#17191a]">{rows.length - excluded}개 데이터 반영</button></div></div></div>;
}
