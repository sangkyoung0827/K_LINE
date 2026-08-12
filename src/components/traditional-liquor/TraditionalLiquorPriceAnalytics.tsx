"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { TraditionalLiquorPagedResult, TraditionalLiquorPriceRow, TraditionalLiquorPriceSort } from "@/lib/traditional-liquor/types";

const ranges = [
  { label: "전체", min: "", max: "" }, { label: "1만원 이하", min: "", max: "10000" },
  { label: "1~3만원", min: "10000", max: "30000" }, { label: "3~5만원", min: "30000", max: "50000" },
  { label: "5만원 이상", min: "50000", max: "" }
];

export function TraditionalLiquorPriceAnalytics({ query, syncUrl }: { query: string; syncUrl: (values: Record<string, string>) => void }) {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<TraditionalLiquorPriceSort>("LOWEST");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TraditionalLiquorPagedResult<TraditionalLiquorPriceRow> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPlatform(params.get("platform") ?? ""); setMinPrice(params.get("min") ?? "");
    setMaxPrice(params.get("max") ?? ""); setSort((params.get("sort") as TraditionalLiquorPriceSort) || "LOWEST");
    setPage(Math.max(1, Number(params.get("page")) || 1)); setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController(); setLoading(true); setError("");
    const params = new URLSearchParams({ q: query, platform, min: minPrice, max: maxPrice, sort, page: String(page) });
    fetch(`/api/v4/traditional-liquor/analytics/price?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.results; })
      .then((results) => setData(results))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason instanceof Error ? reason.message : "가격 데이터를 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    syncUrl({ platform, min: minPrice, max: maxPrice, sort, page: String(page) });
    return () => controller.abort();
  }, [maxPrice, minPrice, page, platform, query, ready, sort, syncUrl]);

  function applyRange(min: string, max: string) { setMinPrice(min); setMaxPrice(max); setPage(1); }

  return <section className="border border-white/10 bg-white/[0.035] p-4 md:p-5">
    <div className="grid gap-3 lg:grid-cols-[180px_1fr_190px]">
      <Filter label="플랫폼"><select value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }} className={controlClass}><option value="">전체 플랫폼</option>{data?.platforms.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></Filter>
      <Filter label="가격대"><div className="flex flex-wrap gap-2">{ranges.map((range) => <button type="button" key={range.label} onClick={() => applyRange(range.min, range.max)} className={`h-10 border px-3 text-xs font-bold ${minPrice === range.min && maxPrice === range.max ? "border-[#f7c76b] bg-[#f7c76b] text-[#17191a]" : "border-white/15 text-white/60"}`}>{range.label}</button>)}</div></Filter>
      <Filter label="정렬"><select value={sort} onChange={(event) => { setSort(event.target.value as TraditionalLiquorPriceSort); setPage(1); }} className={controlClass}><option value="LOWEST">최저가순</option><option value="HIGHEST">최고가순</option><option value="PER_100ML">100ml당 최저가순</option></select></Filter>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Filter label="최소가격"><input inputMode="numeric" value={minPrice} onChange={(event) => { setMinPrice(event.target.value.replace(/\D/g, "")); setPage(1); }} className={controlClass} placeholder="0" /></Filter><Filter label="최대가격"><input inputMode="numeric" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value.replace(/\D/g, "")); setPage(1); }} className={controlClass} placeholder="제한 없음" /></Filter></div>
    {loading ? <Message><LoaderCircle className="h-5 w-5 animate-spin" />가격 데이터를 계산하는 중입니다.</Message> : error ? <Message>{error}<span className="text-xs text-white/35">Supabase 분석 migration 적용 여부를 확인하세요.</span></Message> : data?.rows.length ? <>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-xs"><thead className="border-y border-white/10 text-white/40"><tr><th className="px-3 py-3">상품</th><th className="px-3 py-3">플랫폼</th><th className="px-3 py-3">업체</th><th className="px-3 py-3">가격</th><th className="px-3 py-3">총 용량</th><th className="px-3 py-3">100ml당</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.offerId} className="border-b border-white/8"><td className="px-3 py-3 font-semibold text-white/85">{row.productName}</td><td className="px-3 py-3 text-white/65">{row.platformName}</td><td className="px-3 py-3 text-white/55">{row.sellerName}</td><td className="px-3 py-3 font-bold text-[#f7c76b]">{money(row.price)}</td><td className="px-3 py-3 text-white/52">{row.totalVolumeMl ? `${row.totalVolumeMl}ml` : "-"}</td><td className="px-3 py-3 text-white/52">{row.pricePer100ml === null ? "-" : money(Math.round(row.pricePer100ml))}</td></tr>)}</tbody></table></div>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.total} setPage={setPage} />
    </> : <Message>조건에 맞는 Production Offer가 없습니다.</Message>}
  </section>;
}

const controlClass = "h-10 w-full border border-white/15 bg-[#0e1112] px-3 text-sm text-white outline-none focus:border-[#f7c76b]";
function Filter({ children, label }: { children: React.ReactNode; label: string }) { return <label><span className="mb-2 block text-[10px] font-bold tracking-[0.12em] text-white/42">{label}</span>{children}</label>; }
function Message({ children }: { children: React.ReactNode }) { return <div className="mt-5 flex min-h-40 flex-col items-center justify-center gap-3 border border-white/10 text-sm text-white/50">{children}</div>; }
function Pagination({ page, setPage, total, totalPages }: { page: number; setPage: (value: number) => void; total: number; totalPages: number }) { return <div className="mt-4 flex items-center justify-between text-xs text-white/45"><span>총 {total.toLocaleString("ko-KR")}개</span><div className="flex items-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border border-white/15 p-2 disabled:opacity-25" aria-label="이전 페이지"><ChevronLeft className="h-4 w-4" /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="border border-white/15 p-2 disabled:opacity-25" aria-label="다음 페이지"><ChevronRight className="h-4 w-4" /></button></div></div>; }
function money(value: number) { return `${new Intl.NumberFormat("ko-KR").format(value)}원`; }
