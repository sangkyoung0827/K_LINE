"use client";

import { AlertTriangle, CheckCircle2, Chrome, DatabaseZap, ExternalLink, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collectorPlatforms, type CollectorPlatformCode } from "@/lib/traditional-liquor/collector/platform-registry";
import type { CollectorJobPublic } from "@/lib/traditional-liquor/collector/types";

const jobsEndpoint = "/api/v4/traditional-liquor/collector/jobs";
const completedStatuses = new Set(["COMPLETED", "FAILED", "EXPIRED"]);

export function TraditionalLiquorMarketCollectorPanel({ onBatchReady }: { onBatchReady: (batchId: string) => void }) {
  const [platformCode, setPlatformCode] = useState<CollectorPlatformCode>("NAVER");
  const [query, setQuery] = useState("전통주");
  const [extension, setExtension] = useState<"checking" | "connected" | "missing">("checking");
  const [job, setJob] = useState<CollectorJobPublic | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openedBatchRef = useRef("");
  const platform = useMemo(() => collectorPlatforms.find((item) => item.code === platformCode) ?? collectorPlatforms[0], [platformCode]);

  const pingExtension = useCallback(async () => {
    setExtension("checking");
    const response = await sendExtensionMessage({ type: "WOOHYUKMON_COLLECTOR_PING" }, 1200);
    setExtension(response?.ok ? "connected" : "missing");
  }, []);

  useEffect(() => { void pingExtension(); }, [pingExtension]);
  useEffect(() => {
    if (!job || completedStatuses.has(job.status)) return;
    const timer = window.setInterval(() => {
      void fetch(`${jobsEndpoint}/${encodeURIComponent(job.id)}`, { cache: "no-store" })
        .then(async (response) => { const body = await response.json() as { job?: CollectorJobPublic; error?: string }; if (!response.ok || !body.job) throw new Error(body.error ?? "상태 확인 실패"); return body.job; })
        .then((nextJob) => { setJob(nextJob); if (nextJob.status === "COMPLETED") setBusy(false); })
        .catch((requestError) => { setBusy(false); setError(requestError instanceof Error ? requestError.message : "Collector 상태를 확인하지 못했습니다."); });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);
  useEffect(() => {
    if (job?.status === "COMPLETED" && job.batchId && openedBatchRef.current !== job.batchId) {
      openedBatchRef.current = job.batchId;
      onBatchReady(job.batchId);
    }
  }, [job, onBatchReady]);

  async function startCollection() {
    if (!query.trim()) return;
    setBusy(true); setError(""); setJob(null); openedBatchRef.current = "";
    try {
      if (extension !== "connected") {
        await pingExtension();
        throw new Error("WooHyukmon Collector가 설치되어 있지 않거나 이 페이지에서 응답하지 않습니다.");
      }
      const response = await fetch(jobsEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platformCode, query: query.trim() }) });
      const body = await response.json() as { job?: CollectorJobPublic; collectorToken?: string; error?: string };
      if (!response.ok || !body.job || !body.collectorToken) throw new Error(body.error ?? "Collector Job을 만들지 못했습니다.");
      setJob(body.job);
      const acknowledgement = await sendExtensionMessage({
        type: "WOOHYUKMON_COLLECTOR_START",
        job: { id: body.job.id, collectorToken: body.collectorToken, platformCode, query: body.job.query, targetUrl: body.job.targetUrl, apiOrigin: window.location.origin }
      }, 2500);
      if (!acknowledgement?.ok) throw new Error(acknowledgement?.error ?? "Extension이 수집 요청을 받지 못했습니다.");
    } catch (requestError) {
      setBusy(false);
      setError(requestError instanceof Error ? requestError.message : "수집을 시작하지 못했습니다.");
    }
  }

  const summary = job?.resultSummary ?? {};
  return <div className="border-b border-white/10 bg-[#0f1415]">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
      <div><div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#f7c76b]"><DatabaseZap className="h-4 w-4" />MARKET DATA COLLECTION</div><h2 className="mt-2 text-xl font-semibold">WooHyukmon Market Collector</h2><p className="mt-1 text-xs leading-5 text-white/42">공개 페이지 → Browser Collector → 기존 Staging → Entity Resolution → 명시적 Production Commit</p></div>
      <button type="button" onClick={() => void pingExtension()} title="Collector 연결 확인" className="grid h-9 w-9 place-items-center border border-white/12 text-white/55 hover:text-[#f7c76b]"><RefreshCw className={`h-4 w-4 ${extension === "checking" ? "animate-spin" : ""}`} /></button>
    </header>
    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <label className="block"><span className="text-xs font-bold text-white/60">플랫폼</span><select value={platformCode} onChange={(event) => { setPlatformCode(event.target.value as CollectorPlatformCode); setJob(null); }} className="mt-2 h-11 w-full border border-white/15 bg-[#0e1112] px-3 text-sm text-white outline-none focus:border-[#f7c76b]">{collectorPlatforms.map((item) => <option key={item.code} value={item.code}>{item.displayName}</option>)}</select></label>
        <label className="block"><span className="text-xs font-bold text-white/60">검색어</span><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} className="mt-2 h-11 w-full border border-white/15 bg-[#0e1112] px-3 text-sm text-white outline-none focus:border-[#f7c76b]" /></label>
        <div className="flex items-center justify-between border border-white/10 px-3 py-2.5 text-xs"><span className="flex items-center gap-2 text-white/55"><Chrome className="h-4 w-4" />Collector</span><span className={extension === "connected" ? "font-bold text-emerald-300" : extension === "checking" ? "text-white/40" : "font-bold text-amber-200"}>● {extension === "connected" ? "연결됨" : extension === "checking" ? "확인 중" : "설치 필요"}</span></div>
        {extension === "missing" ? <a href="https://github.com/sangkyoung0827/K_LINE/tree/main/extensions/woo-hyukmon-market-collector" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#f7c76b]">설치 방법 보기<ExternalLink className="h-3.5 w-3.5" /></a> : null}
        <button type="button" onClick={() => void startCollection()} disabled={busy || extension !== "connected" || !query.trim()} className="inline-flex h-12 w-full items-center justify-center gap-2 bg-[#f7c76b] text-sm font-bold text-[#17191a] disabled:opacity-35">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}수집 시작</button>
      </div>
      <div className="border border-white/10 p-4">
        <p className="text-xs font-bold text-white/60">수집 가능한 데이터</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{platform.metrics.map((metric) => <div key={metric.type} className={`flex items-start gap-2 text-xs ${metric.availability === "UNAVAILABLE" ? "text-white/30" : "text-white/65"}`}>{metric.availability === "UNAVAILABLE" ? <span>―</span> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}<span>{metric.displayName}{metric.note ? <small className="mt-1 block text-[10px] text-white/28">{metric.note}</small> : null}</span></div>)}</div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-bold tracking-[0.12em] text-[#f7c76b]">COLLECTOR STATUS</p>
          <p className="mt-2 text-sm font-bold text-white/75">{job ? statusLabel(job.status) : "수집 대기"}</p>
          {job ? <p className="mt-1 truncate text-[10px] text-white/30">{job.platformCode} · {job.query} · {job.id}</p> : null}
          {job?.status === "COMPLETED" ? <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Summary label="상품" value={summary.products} /><Summary label="가격 Offer" value={summary.offers} />{platform.metrics.filter((metric) => metric.type !== "PRICE").map((metric) => <Summary key={metric.type} label={metric.displayName} value={(summary.metrics as Record<string, number> | undefined)?.[metric.type]} />)}<Summary label="건너뜀" value={summary.skipped} /></div> : null}
          {job?.diagnostics?.warnings?.length ? <div className="mt-3 space-y-1 text-[10px] leading-4 text-amber-100/70">{job.diagnostics.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div> : null}
          {job?.status === "COMPLETED" && job.batchId ? <button type="button" onClick={() => onBatchReady(job.batchId!)} className="mt-4 h-9 w-full border border-[#f7c76b]/45 text-xs font-bold text-[#f7c76b]">Preview 열기</button> : null}
        </div>
      </div>
    </div>
    {error || job?.errorMessage ? <div className="flex gap-2 border-t border-red-300/20 bg-red-300/7 px-5 py-3 text-xs text-red-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error || job?.errorMessage}</div> : null}
  </div>;
}

function sendExtensionMessage(message: Record<string, unknown>, timeoutMs: number) {
  const requestId = crypto.randomUUID();
  return new Promise<{ ok?: boolean; error?: string } | null>((resolve) => {
    const timer = window.setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== "WOOHYUKMON_EXTENSION" || event.data.requestId !== requestId) return;
      cleanup(); resolve(event.data);
    };
    function cleanup() { window.clearTimeout(timer); window.removeEventListener("message", listener); }
    window.addEventListener("message", listener);
    window.postMessage({ source: "KLINE_WEB", requestId, ...message }, location.origin);
  });
}

function statusLabel(status: CollectorJobPublic["status"]) {
  return ({ PENDING: "Collector 응답 대기 중...", DISPATCHED: "수집 페이지 여는 중...", RUNNING: "상품 데이터 분석 중...", UPLOADING: "Staging으로 업로드 중...", COMPLETED: "수집 완료", FAILED: "수집 실패", EXPIRED: "요청 만료" } as const)[status];
}

function Summary({ label, value }: { label: string; value: unknown }) { return <div className="border border-white/8 p-2"><span className="block text-[9px] text-white/32">{label}</span><strong className="mt-1 block text-[#f7c76b]">{Number(value ?? 0).toLocaleString()}</strong></div>; }
