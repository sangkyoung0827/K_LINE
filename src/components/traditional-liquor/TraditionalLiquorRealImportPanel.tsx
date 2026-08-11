"use client";

import { AlertTriangle, CheckCircle2, Download, FileSearch, Link2, LoaderCircle, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CommitResult, RealStagingRow, ResolutionResult } from "@/lib/traditional-liquor/import/real-import-repository";
import { fieldsForImportType, type ColumnMapping, type RealImportAnalysis, type RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

const endpoint = "/api/v4/traditional-liquor/import";
type Batch = { id: string; status: string; total_rows: number; valid_rows: number; invalid_rows: number; inserted_rows: number; updated_rows: number; skipped_rows: number; file_name: string | null; import_type: RealImportType | null; created_at: string };

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
  const [resolution, setResolution] = useState<ResolutionResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadBatches = useCallback(async () => {
    try { setBatches((await jsonRequest<{ batches: Batch[] }>(`${endpoint}?resource=batches`)).batches); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Import Batch를 불러오지 못했습니다."); }
  }, []);
  useEffect(() => { void loadBatches(); }, [loadBatches]);

  function formData(action: "analyze" | "stage") {
    if (!file) throw new Error("CSV, XLSX 또는 JSON 파일을 선택하세요.");
    if (!sourceName.trim()) throw new Error("Source 이름을 입력하세요.");
    const form = new FormData();
    form.set("action", action); form.set("file", file); form.set("importType", importType); form.set("sourceName", sourceName.trim());
    if (observedAt) form.set("observedAt", new Date(observedAt).toISOString());
    if (action === "stage") form.set("mapping", JSON.stringify(mapping));
    return form;
  }

  async function analyzeFile() {
    setBusy(true); setAnalysis(null); setError(""); setCommitResult(null);
    try { const body = await jsonRequest<{ analysis: RealImportAnalysis }>(endpoint, { method: "POST", body: formData("analyze") }); setAnalysis(body.analysis); setMapping(body.analysis.suggestedMapping); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "파일을 분석하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function stageFile() {
    setBusy(true); setError("");
    try {
      const body = await jsonRequest<{ result: { batchId: string } }>(endpoint, { method: "POST", body: formData("stage") });
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

  async function commit() {
    if (!selectedBatch) return;
    setBusy(true); setError(""); setConfirmOpen(false);
    try { const body = await jsonRequest<{ result: CommitResult }>(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "commit", batchId: selectedBatch.id }) }); await loadBatches(); await openBatch(selectedBatch.id); setCommitResult(body.result); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Production 반영에 실패했습니다."); }
    finally { setBusy(false); }
  }

  const reviewCount = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "MANUAL_REVIEW").length;
  const unresolvedCount = rows.filter((row) => row.validation_status === "VALID" && row.resolution_status === "UNRESOLVED").length;
  const committable = !!selectedBatch && selectedBatch.status === "READY" && rows.some((row) => row.validation_status === "VALID" && row.review_action !== "EXCLUDE") && reviewCount === 0 && unresolvedCount === 0;

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

    {analysis ? <MappingEditor analysis={analysis} mapping={mapping} onChange={setMapping} onStage={() => void stageFile()} busy={busy} /> : null}
    <div className="grid lg:grid-cols-[280px_1fr]">
      <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r"><p className="px-1 text-xs font-bold text-white/55">실제 Import Batch</p><div className="mt-3 max-h-[520px] space-y-2 overflow-auto">{batches.map((batch) => <button key={batch.id} type="button" onClick={() => void openBatch(batch.id)} className={`w-full border p-3 text-left ${selectedBatch?.id === batch.id ? "border-[#f7c76b] bg-[#f7c76b]/7" : "border-white/10 bg-black/10"}`}><div className="flex justify-between gap-2"><span className="truncate text-xs font-bold text-white/75">{batch.file_name}</span><span className="text-[9px] font-bold text-[#f7c76b]">{batch.status}</span></div><p className="mt-1 text-[10px] text-white/34">{batch.import_type} · {batch.total_rows}행 · 오류 {batch.invalid_rows}</p></button>)}</div></div>
      <div className="min-w-0 p-5">{selectedBatch ? <BatchWorkspace batch={selectedBatch} rows={rows} resolution={resolution} busy={busy} committable={committable} onResolve={() => void resolve()} onReview={review} onCommit={() => setConfirmOpen(true)} /> : <div className="grid min-h-48 place-items-center text-sm text-white/32">분석할 실제 Import Batch를 선택하세요.</div>}</div>
    </div>
    {commitResult ? <div className="border-t border-emerald-300/20 bg-emerald-300/7 p-5"><div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-5 w-5" />Production 반영 완료</div><p className="mt-2 text-xs text-white/55">Products +{commitResult.productsInserted} / Updated {commitResult.productsUpdated} · Breweries +{commitResult.breweriesInserted} · Sellers +{commitResult.sellersInserted} · Offers +{commitResult.offersInserted} / Updated {commitResult.offersUpdated} · History +{commitResult.priceHistoryInserted}</p></div> : null}
    {confirmOpen && selectedBatch ? <CommitModal batch={selectedBatch} rows={rows} onCancel={() => setConfirmOpen(false)} onConfirm={() => void commit()} /> : null}
  </section>;
}

function TypeButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`min-h-11 border px-3 text-xs font-bold ${active ? "border-[#f7c76b] bg-[#f7c76b]/12 text-[#f7c76b]" : "border-white/12 text-white/48"}`}>{children}</button>; }

function MappingEditor({ analysis, mapping, onChange, onStage, busy }: { analysis: RealImportAnalysis; mapping: ColumnMapping; onChange: (mapping: ColumnMapping) => void; onStage: () => void; busy: boolean }) {
  const fields = fieldsForImportType(analysis.importType);
  return <div className="border-b border-white/10 p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-bold">Column Mapping</h3><p className="mt-1 text-xs text-white/38">{analysis.fileName} · {analysis.totalRows}행 · {analysis.fileType}</p></div><button type="button" onClick={onStage} disabled={busy || Object.keys(mapping).length === 0} className="h-10 bg-[#f7c76b] px-5 text-xs font-bold text-[#17191a] disabled:opacity-40">Staging에 저장</button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{analysis.headers.map((header) => <label key={header} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 border border-white/8 bg-black/10 p-2"><span className="truncate text-xs text-white/55">{header}</span><select value={mapping[header] ?? ""} onChange={(event) => onChange({ ...mapping, [header]: event.target.value })} className="h-8 min-w-0 border border-white/12 bg-[#0e1112] px-2 text-[11px] text-white"><option value="">사용 안 함</option>{fields.map((field) => <option key={field} value={field}>{field}</option>)}</select></label>)}</div></div>;
}

function BatchWorkspace({ batch, rows, resolution, busy, committable, onResolve, onReview, onCommit }: { batch: Batch; rows: RealStagingRow[]; resolution: ResolutionResult | null; busy: boolean; committable: boolean; onResolve: () => void; onReview: (row: RealStagingRow, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids?: Record<string, string>) => void; onCommit: () => void }) {
  return <><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold">{batch.file_name}</h3><p className="mt-1 text-xs text-white/35">총 {batch.total_rows} · VALID {batch.valid_rows} · INVALID {batch.invalid_rows} · {batch.status}</p></div><div className="flex gap-2"><button type="button" onClick={onResolve} disabled={busy || batch.status !== "READY"} className="h-9 border border-[#f7c76b]/50 px-3 text-[10px] font-bold text-[#f7c76b] disabled:opacity-35">Entity Resolution 실행</button><button type="button" onClick={onCommit} disabled={busy || !committable} className="h-9 bg-[#f7c76b] px-3 text-[10px] font-bold text-[#17191a] disabled:opacity-35">Production DB에 반영</button></div></div>
    {resolution ? <p className="mt-3 text-xs text-white/48">MATCHED {resolution.matched} · NEW {resolution.newEntity} · REVIEW {resolution.manualReview} · INVALID {resolution.invalid}</p> : null}
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/35"><tr><th className="px-3 py-2">행</th><th className="px-3 py-2">제품 / Listing</th><th className="px-3 py-2">Seller / Brewery</th><th className="px-3 py-2">가격</th><th className="px-3 py-2">Validation</th><th className="px-3 py-2">Resolution</th><th className="px-3 py-2">검토</th></tr></thead><tbody>{rows.map((row) => { const data = row.normalized_data; return <tr key={row.id} className="border-b border-white/8"><td className="px-3 py-3 text-white/30">{row.row_number}</td><td className="max-w-56 truncate px-3 py-3 font-semibold text-white/75">{String(data.productName ?? data.listingTitle ?? "-")}</td><td className="px-3 py-3 text-white/48">{String(data.sellerName ?? data.breweryName ?? "-")}</td><td className="px-3 py-3 text-[#f7c76b]">{data.price ? `${Number(data.price).toLocaleString("ko-KR")}원` : "-"}</td><td className={row.validation_status === "VALID" ? "px-3 py-3 text-emerald-300" : "px-3 py-3 text-red-300"}>{row.validation_status}</td><td className={`px-3 py-3 font-bold ${row.resolution_status === "MANUAL_REVIEW" ? "text-red-300" : row.resolution_status === "NEW_ENTITY" ? "text-[#f7c76b]" : "text-white/55"}`}>{row.review_action === "EXCLUDE" ? "EXCLUDED" : row.resolution_status}</td><td className="px-3 py-3">{row.resolution_status === "MANUAL_REVIEW" ? <ReviewActions row={row} onReview={onReview} /> : "-"}</td></tr>; })}</tbody></table></div></>;
}

function ReviewActions({ row, onReview }: { row: RealStagingRow; onReview: (row: RealStagingRow, action: "LINK_EXISTING" | "CREATE_NEW" | "EXCLUDE", ids?: Record<string, string>) => void }) {
  const candidates = (row.resolution_data?.candidates ?? {}) as Record<string, Array<{ id: string; name: string }>>;
  const [ids, setIds] = useState<Record<string, string>>({ productId: candidates.products?.[0]?.id ?? "", sellerId: candidates.sellers?.[0]?.id ?? "", platformId: candidates.platforms?.[0]?.id ?? "", breweryId: candidates.breweries?.[0]?.id ?? "" });
  const groups = [["products", "productId", "제품"], ["sellers", "sellerId", "업체"], ["platforms", "platformId", "플랫폼"], ["breweries", "breweryId", "양조장"]] as const;
  return <div className="min-w-56 space-y-1.5">{groups.filter(([group]) => candidates[group]?.length).map(([group, key, label]) => <select key={group} aria-label={`${label} 후보`} value={ids[key]} onChange={(event) => setIds({ ...ids, [key]: event.target.value })} className="h-7 w-full border border-white/12 bg-[#0e1112] px-2 text-[9px] text-white/65"><option value="">{label} 선택</option>{candidates[group].map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>)}<div className="flex gap-1"><button type="button" onClick={() => onReview(row, "LINK_EXISTING", ids)} className="h-7 border border-white/15 px-2 text-[9px] text-white/60"><Link2 className="mr-1 inline h-3 w-3" />기존 연결</button><button type="button" onClick={() => onReview(row, "CREATE_NEW", ids)} className="h-7 border border-white/15 px-2 text-[9px] text-white/60">신규 생성</button><button type="button" onClick={() => onReview(row, "EXCLUDE")} className="h-7 border border-red-300/20 px-2 text-[9px] text-red-200">제외</button></div></div>;
}

function CommitModal({ batch, rows, onCancel, onConfirm }: { batch: Batch; rows: RealStagingRow[]; onCancel: () => void; onConfirm: () => void }) {
  const excluded = rows.filter((row) => row.review_action === "EXCLUDE" || row.validation_status === "INVALID").length;
  const newRows = rows.filter((row) => row.resolution_status === "NEW_ENTITY" && row.review_action !== "EXCLUDE").length;
  const matched = rows.filter((row) => row.resolution_status === "MATCHED" && row.review_action !== "EXCLUDE").length;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5"><div role="dialog" aria-modal="true" aria-labelledby="commit-title" className="w-full max-w-md border border-white/15 bg-[#17191a] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-[#f7c76b]">IRREVERSIBLE PRODUCTION ACTION</p><h3 id="commit-title" className="mt-2 text-xl font-bold">실제 DB 반영</h3></div><button type="button" onClick={onCancel} title="닫기" className="grid h-8 w-8 place-items-center text-white/50"><X className="h-4 w-4" /></button></div><dl className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-xs"><dt className="text-white/40">신규 예상 행</dt><dd className="text-right font-bold text-[#f7c76b]">{newRows}</dd><dt className="text-white/40">기존 연결 행</dt><dd className="text-right font-bold">{matched}</dd><dt className="text-white/40">제외 / Invalid</dt><dd className="text-right font-bold">{excluded}</dd><dt className="text-white/40">Batch</dt><dd className="truncate text-right text-white/45">{batch.id}</dd></dl><p className="mt-4 text-xs leading-5 text-white/45">제품, 양조장, 업체, Offer와 Price History를 하나의 DB 트랜잭션으로 반영합니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="h-11 border border-white/15 text-xs font-bold text-white/60">취소</button><button type="button" onClick={onConfirm} className="h-11 bg-[#f7c76b] text-xs font-bold text-[#17191a]">{rows.length - excluded}개 데이터 반영</button></div></div></div>;
}
