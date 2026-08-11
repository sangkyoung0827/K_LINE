"use client";

import { AlertTriangle, CheckCircle2, DatabaseZap, LoaderCircle, Play, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CollectionQuery, CollectionQueryType, CollectionResult } from "@/lib/traditional-liquor/collection/types";
import type { ImportBatchRecord, ImportPreview } from "@/lib/traditional-liquor/import/types";

const endpoint = "/api/v4/traditional-liquor/collection";
const queryTypes: CollectionQueryType[] = ["GENERAL", "CATEGORY", "PRODUCT", "BRAND", "BREWERY", "DISCOVERY"];

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "요청을 처리하지 못했습니다.");
  return body;
}

export function TraditionalLiquorCollectionPanel() {
  const [queries, setQueries] = useState<CollectionQuery[]>([]);
  const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [newType, setNewType] = useState<CollectionQueryType>("DISCOVERY");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [queryBody, batchBody] = await Promise.all([
        requestJson<{ queries: CollectionQuery[] }>(`${endpoint}?resource=queries`),
        requestJson<{ batches: ImportBatchRecord[] }>(`${endpoint}?resource=batches`)
      ]);
      setQueries(queryBody.queries);
      setBatches(batchBody.batches);
      setSelectedQueryId((current) => current || queryBody.queries.find((item) => item.enabled)?.id || "");
      setError("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "수집 데이터를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selectedQuery = useMemo(() => queries.find((item) => item.id === selectedQueryId), [queries, selectedQueryId]);

  async function addQuery() {
    if (!newQuery.trim()) return;
    setBusy(true);
    try {
      await requestJson(endpoint, { method: "POST", body: JSON.stringify({ action: "create-query", query: newQuery, queryType: newType, priority: 50 }) });
      setNewQuery(""); await load();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "검색어를 추가하지 못했습니다."); setBusy(false); }
  }

  async function updateQuery(id: string, update: { enabled?: boolean; priority?: number }) {
    setBusy(true);
    try { await requestJson(endpoint, { method: "PATCH", body: JSON.stringify({ id, ...update }) }); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "검색어를 수정하지 못했습니다."); setBusy(false); }
  }

  async function runCollection() {
    if (!selectedQueryId) return;
    setBusy(true); setPreview(null); setResult(null);
    try {
      const body = await requestJson<{ result: CollectionResult }>(endpoint, { method: "POST", body: JSON.stringify({ action: "collect", queryId: selectedQueryId }) });
      setResult(body.result); setError(""); await load(); await openPreview(body.result.batchId);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "수집을 실행하지 못했습니다."); setBusy(false); }
  }

  async function openPreview(batchId: string) {
    setBusy(true);
    try { const body = await requestJson<{ preview: ImportPreview }>(`${endpoint}?resource=preview&batchId=${encodeURIComponent(batchId)}`); setPreview(body.preview); setError(""); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Batch Preview를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <section className="mt-10 border border-white/10 bg-white/[0.025]">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">
      <div><div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.15em] text-[#f7c76b]"><DatabaseZap className="h-4 w-4" />FIXTURE / TEST</div><h2 className="mt-2 text-xl font-semibold text-white">Regression Collection Preview</h2><p className="mt-1 text-xs leading-5 text-white/42">테스트 Fixture를 검증·정규화하여 Staging까지만 저장합니다. 실제 데이터 입력은 위 V2 Import를 사용합니다.</p></div>
      <button type="button" onClick={() => void load()} disabled={busy} title="새로고침" className="grid h-10 w-10 place-items-center border border-white/15 text-white/60 transition hover:border-[#f7c76b] hover:text-[#f7c76b] disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /></button>
    </header>

    {error ? <div className="flex items-start gap-2 border-b border-red-400/20 bg-red-400/8 px-5 py-3 text-xs text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}<span className="text-red-200/55">Collection Engine SQL migration과 서버 환경변수를 확인하세요.</span></div> : null}

    <div className="grid lg:grid-cols-[1.05fr_.95fr]">
      <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
        <h3 className="text-sm font-bold text-white">Query 관리</h3>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={newQuery} onChange={(event) => setNewQuery(event.target.value)} placeholder="새 검색어" className="h-10 min-w-0 flex-1 border border-white/15 bg-[#0e1112] px-3 text-sm text-white outline-none focus:border-[#f7c76b]" />
          <select value={newType} onChange={(event) => setNewType(event.target.value as CollectionQueryType)} className="h-10 border border-white/15 bg-[#0e1112] px-3 text-xs text-white outline-none">{queryTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <button type="button" onClick={() => void addQuery()} disabled={busy || !newQuery.trim()} className="inline-flex h-10 items-center justify-center gap-2 bg-[#f7c76b] px-4 text-xs font-bold text-[#17191a] disabled:opacity-40"><Plus className="h-4 w-4" />추가</button>
        </div>
        <div className="mt-4 max-h-80 overflow-auto border-y border-white/10">
          {queries.map((item) => <div key={item.id} className="grid grid-cols-[minmax(90px,1fr)_86px_70px_52px] items-center gap-2 border-b border-white/8 py-2.5 text-xs last:border-b-0">
            <button type="button" onClick={() => setSelectedQueryId(item.id)} className={`truncate text-left font-semibold ${selectedQueryId === item.id ? "text-[#f7c76b]" : "text-white/72"}`}>{item.query}</button>
            <span className="truncate text-[10px] text-white/36">{item.queryType}</span>
            <input aria-label={`${item.query} 우선순위`} type="number" min={0} max={1000} defaultValue={item.priority} onBlur={(event) => { const next = Number(event.target.value); if (next !== item.priority) void updateQuery(item.id, { priority: next }); }} className="h-7 w-full border border-white/12 bg-black/20 px-2 text-right text-white/65 outline-none focus:border-[#f7c76b]" />
            <button type="button" onClick={() => void updateQuery(item.id, { enabled: !item.enabled })} className={`h-7 text-[10px] font-bold ${item.enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-white/7 text-white/32"}`}>{item.enabled ? "ON" : "OFF"}</button>
          </div>)}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-bold text-white">수집 실행</h3>
        <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-3 text-xs"><dt className="text-white/35">Source</dt><dd className="font-semibold text-white/72">FIXTURE / TEST</dd><dt className="text-white/35">Query</dt><dd className="font-semibold text-[#f7c76b]">{selectedQuery?.query ?? "선택되지 않음"}</dd><dt className="text-white/35">Commit</dt><dd className="text-white/45">Staging only</dd></dl>
        <button type="button" onClick={() => void runCollection()} disabled={busy || !selectedQuery?.enabled} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 bg-[#f7c76b] text-sm font-bold text-[#17191a] disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}수집 시작</button>
        {result ? <div className="mt-4 border border-emerald-300/20 bg-emerald-300/7 p-4"><div className="flex items-center gap-2 text-xs font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" />수집 완료 · READY</div><p className="mt-2 text-xs text-white/55">{result.total} listings · {result.valid} VALID · {result.invalid} INVALID</p><p className="mt-1 truncate text-[10px] text-white/28">Batch {result.batchId}</p></div> : null}
      </div>
    </div>

    <div className="border-t border-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-white">Import Batch</h3><span className="text-[10px] text-white/32">최근 {batches.length}개</span></div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{batches.map((batch) => <button key={batch.id} type="button" onClick={() => void openPreview(batch.id)} className={`min-w-48 border px-3 py-3 text-left ${preview?.batch.id === batch.id ? "border-[#f7c76b] bg-[#f7c76b]/8" : "border-white/10 bg-black/10"}`}><p className="text-[10px] font-bold text-[#f7c76b]">{batch.status}</p><p className="mt-1 text-xs font-semibold text-white/70">총 {batch.totalRows} · 정상 {batch.validRows} · 오류 {batch.invalidRows}</p><p className="mt-1 truncate text-[9px] text-white/28">{batch.id}</p></button>)}</div>
    </div>

    {preview ? <PreviewTable preview={preview} /> : null}
  </section>;
}

function PreviewTable({ preview }: { preview: ImportPreview }) {
  return <div className="border-t border-white/10 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">수집 결과 Preview</h3><p className="mt-1 text-[10px] text-white/30">{preview.run ? `${preview.run.sourceCode} · ${preview.run.queryText} · ` : ""}Batch {preview.batch.id}</p></div><button type="button" disabled title="V2 Commit Pipeline에서 제공됩니다" className="h-9 border border-white/10 px-3 text-[10px] font-bold text-white/25">Production 반영 · V2</button></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/35"><tr><th className="px-3 py-2.5">상품명</th><th className="px-3 py-2.5">판매업체</th><th className="px-3 py-2.5">가격</th><th className="px-3 py-2.5">플랫폼</th><th className="px-3 py-2.5">용량 × 수량</th><th className="px-3 py-2.5">URL</th><th className="px-3 py-2.5">Validation</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.id} className="border-b border-white/8"><td className="px-3 py-3 font-semibold text-white/75">{row.normalizedData.listingTitle || "(상품명 없음)"}</td><td className="px-3 py-3 text-white/50">{row.normalizedData.sellerName ?? "-"}</td><td className="px-3 py-3 text-[#f7c76b]">{row.normalizedData.price === null || row.normalizedData.price === undefined ? "-" : `${row.normalizedData.price.toLocaleString("ko-KR")}원`}</td><td className="px-3 py-3 text-white/45">{row.normalizedData.platformCode ?? "-"}</td><td className="px-3 py-3 text-white/45">{row.normalizedData.listingVolumeMl ?? "-"}ml × {row.normalizedData.quantity ?? "-"}</td><td className="max-w-52 truncate px-3 py-3 text-white/35">{row.normalizedData.listingUrl ?? "-"}</td><td className={`px-3 py-3 font-bold ${row.validationStatus === "VALID" ? "text-emerald-300" : "text-red-300"}`}>{row.validationStatus}</td></tr>)}</tbody></table></div>
    {preview.errors.length ? <div className="mt-4 border-l-2 border-red-300/60 bg-red-300/5 p-3"><p className="text-xs font-bold text-red-200">검증 메시지 {preview.errors.length}건</p><div className="mt-2 space-y-1 text-[11px] text-white/48">{preview.errors.map((item, index) => <p key={`${item.rowNumber}-${item.code}-${index}`}>Row {item.rowNumber} · {item.code} · {item.message.replace(/^(ERROR|WARNING):\s*/, "")}</p>)}</div></div> : null}
  </div>;
}
