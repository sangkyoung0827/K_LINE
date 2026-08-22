"use client";

import { ArrowLeft, Building2, Database, ExternalLink, LoaderCircle, PackageSearch, Search, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TraditionalLiquorRealImportPanel } from "@/components/traditional-liquor/TraditionalLiquorRealImportPanel";
import { TraditionalLiquorPriceAnalytics } from "@/components/traditional-liquor/TraditionalLiquorPriceAnalytics";
import { TraditionalLiquorSalesAnalytics } from "@/components/traditional-liquor/TraditionalLiquorSalesAnalytics";
import type { Offer, Platform, PlatformResult, ProductResult, Seller, SellerResult, TraditionalLiquorAnalyticsResponse, TraditionalLiquorSearchResult, TraditionalLiquorView } from "@/lib/traditional-liquor/types";

const tabs: Array<{ id: TraditionalLiquorView; label: string }> = [
  { id: "product", label: "제품별" },
  { id: "platform", label: "플랫폼별" },
  { id: "seller", label: "업체별" },
  { id: "price", label: "가격별" },
  { id: "sales", label: "판매량별" }
];

export function TraditionalLiquorDatabase({ initialState, mode = "page", onBack }: { initialState?: TraditionalLiquorAnalyticsResponse; mode?: "page" | "embedded"; onBack?: () => void }) {
  const embedded = mode === "embedded";
  const showAnalyticsNavigation = !embedded || initialState?.view === "OVERVIEW";
  const [activeView, setActiveView] = useState<TraditionalLiquorView>(() => analyticsViewToView(initialState?.view));
  const [dataCollectionOpen, setDataCollectionOpen] = useState(false);
  const [query, setQuery] = useState(initialState?.filters?.query ?? initialState?.filters?.productName ?? initialState?.filters?.sellerName ?? "");
  const [fullscreenParameters, setFullscreenParameters] = useState<Record<string, string>>({});
  const [results, setResults] = useState<TraditionalLiquorSearchResult | null>(null);
  const [status, setStatus] = useState<"initial" | "loading" | "success" | "empty" | "error">("initial");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (embedded) return;
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view") as TraditionalLiquorView | null;
    if (requestedView && tabs.some((tab) => tab.id === requestedView)) setActiveView(requestedView);
    setDataCollectionOpen(params.get("section") === "collection");
    setQuery(params.get("q") ?? "");
  }, [embedded]);

  const syncUrl = useCallback((values: Record<string, string>) => {
    setFullscreenParameters((current) => ({ ...current, ...values }));
    if (embedded) return;
    const params = new URLSearchParams(window.location.search);
    params.set("view", activeView);
    Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [activeView, embedded]);

  function selectView(view: TraditionalLiquorView) {
    setDataCollectionOpen(false);
    setActiveView(view);
    setFullscreenParameters({});
    if (embedded) return;
    const params = new URLSearchParams(); params.set("view", view);
    if (query) params.set("q", query);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function openDataCollection() {
    if (embedded) return;
    setDataCollectionOpen(true);
    setFullscreenParameters({});
    const params = new URLSearchParams(); params.set("section", "collection");
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (dataCollectionOpen || activeView === "price" || activeView === "sales") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setStatus("loading");
      fetch(`/api/v4/traditional-liquor/market?q=${encodeURIComponent(query)}`, { cache: "no-store" }).then(async (response) => {
        const body = await response.json() as { results?: TraditionalLiquorSearchResult; error?: string };
        if (!response.ok || !body.results) throw new Error(body.error ?? "실제 Market DB를 불러오지 못했습니다.");
        return body.results;
      }).then((nextResults) => {
        if (!active) return;
        const count = nextResults.products.length + nextResults.platforms.length + nextResults.sellers.length + nextResults.breweries.length;
        setResults(nextResults);
        setStatus(count ? "success" : "empty");
        setError("");
      }).catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "전통주 데이터를 불러오지 못했습니다.");
        setStatus("error");
      });
    }, query ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeView, dataCollectionOpen, query, retry]);

  const visibleCount = useMemo(() => {
    if (!results) return 0;
    if (activeView === "product") return results.products.length;
    if (activeView === "platform") return results.platforms.length;
    if (activeView === "seller") return results.sellers.length;
    return 0;
  }, [activeView, results]);

  return (
    <main className={`${embedded ? "w-full bg-[#111718] p-3 sm:p-4" : "mx-auto min-h-screen w-full max-w-7xl bg-[#111718] px-5 py-8 md:px-8 md:py-10"} text-white`}>
      <div className={`flex flex-wrap items-start justify-between gap-4 ${embedded ? "border-b border-white/10 pb-4" : ""}`}>
        <div>
          {onBack ? <button type="button" onClick={onBack} className="mb-5 inline-flex h-9 items-center gap-2 border border-white/15 px-3 text-xs font-semibold text-white/65 transition hover:border-[#f7c76b]/60 hover:text-[#f7c76b]"><ArrowLeft className="h-4 w-4" />우혁몬 4.0으로 돌아가기</button> : null}
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]"><Database className="h-4 w-4" />STRUCTURED MARKET DATA</div>
          <h1 className={`${embedded ? "mt-2 text-xl sm:text-2xl" : "mt-3 text-3xl md:text-5xl"} font-semibold text-white`}>전통주 DATABASE</h1>
          {!embedded ? <p className="mt-3 max-w-3xl text-sm leading-6 text-white/56">제품, 판매 플랫폼, 판매업체의 관계를 조회하는 우혁몬 4.0 전통주 시장 데이터 모듈입니다.</p> : null}
        </div>
        {embedded ? <Link href={buildFullscreenHref(activeView, query, fullscreenParameters)} className="inline-flex min-h-9 items-center gap-2 border border-[#f7c76b]/35 px-3 text-[10px] font-bold text-[#f7c76b] transition hover:bg-[#f7c76b] hover:text-[#17191a]">전체 화면으로 열기<ExternalLink className="h-3.5 w-3.5" /></Link> : <span className="border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-[#f7c76b]">POSTGRESQL MARKET DATA</span>}
      </div>

      <section className={`${embedded ? "mt-4" : "mt-8"} border border-white/10 bg-white/[0.035]`}>
        {showAnalyticsNavigation ? <div className="flex overflow-x-auto border-b border-white/10" role="tablist" aria-label="전통주 데이터 분류">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={!dataCollectionOpen && activeView === tab.id} onClick={() => selectView(tab.id)} className={`min-h-12 min-w-28 border-r border-white/10 px-5 text-sm font-bold transition ${!dataCollectionOpen && activeView === tab.id ? "bg-[#f7c76b] text-[#17191a]" : "text-white/58 hover:bg-white/5 hover:text-white"}`}>{tab.label}</button>)}
          {!embedded ? <button type="button" role="tab" aria-selected={dataCollectionOpen} onClick={openDataCollection} className={`order-first min-h-12 min-w-40 border-r border-white/10 px-5 text-sm font-bold transition ${dataCollectionOpen ? "bg-[#f7c76b] text-[#17191a]" : "text-white/58 hover:bg-white/5 hover:text-white"}`}>비즈니스 데이터 수집</button> : null}
        </div> : null}
        {!dataCollectionOpen ? <div className="p-4 md:p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); syncUrl({ q: event.target.value, page: "1" }); }} placeholder="전통주, 플랫폼, 업체를 검색하세요" className="h-12 w-full border border-white/15 bg-[#0e1112] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[#f7c76b]" />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/38"><span>PRODUCT · PLATFORM · SELLER · BREWERY 통합 검색</span>{activeView === "price" || activeView === "sales" ? null : <span>{status === "loading" ? "검색 중" : `${visibleCount}개 결과`}</span>}</div>
        </div> : null}
      </section>

      {!dataCollectionOpen ? <section className="mt-4">
        {activeView === "price" ? <TraditionalLiquorPriceAnalytics initialFilters={initialState?.filters} mode={mode} query={query} syncUrl={syncUrl} /> : null}
        {activeView === "sales" ? <TraditionalLiquorSalesAnalytics initialFilters={initialState?.filters} mode={mode} query={query} syncUrl={syncUrl} /> : null}
        {activeView !== "price" && activeView !== "sales" && (status === "initial" || status === "loading") ? <StateMessage icon={<LoaderCircle className="h-5 w-5 animate-spin" />} label="전통주 데이터를 불러오는 중입니다." /> : null}
        {activeView !== "price" && activeView !== "sales" && status === "error" ? <StateMessage label={error || "전통주 데이터를 불러오지 못했습니다."} onRetry={() => setRetry((current) => current + 1)} /> : null}
        {activeView !== "price" && activeView !== "sales" && (status === "empty" || (status === "success" && visibleCount === 0)) ? <StateMessage label={query ? "검색 결과가 없습니다." : "등록된 실제 전통주 데이터가 없습니다."} /> : null}
        {activeView !== "price" && activeView !== "sales" && status === "success" && results ? <>
          {activeView === "product" ? <ProductView products={results.products} query={query} breweries={results.breweries} /> : null}
          {activeView === "platform" ? <PlatformView platforms={results.platforms} /> : null}
          {activeView === "seller" ? <SellerView sellers={results.sellers} /> : null}
        </> : null}
      </section> : null}
      {!embedded && dataCollectionOpen ? <TraditionalLiquorRealImportPanel /> : null}
    </main>
  );
}

export function TraditionalLiquorAnalyticsShell({ initialState }: { initialState: TraditionalLiquorAnalyticsResponse }) {
  return <TraditionalLiquorDatabase initialState={initialState} mode="embedded" />;
}

function analyticsViewToView(view?: TraditionalLiquorAnalyticsResponse["view"]): TraditionalLiquorView {
  if (view === "PLATFORM") return "platform";
  if (view === "SELLER") return "seller";
  if (view === "PRICE") return "price";
  if (view === "SALES") return "sales";
  return "product";
}

function buildFullscreenHref(view: TraditionalLiquorView, query: string, values: Record<string, string>) {
  const params = new URLSearchParams({ view });
  if (query) params.set("q", query);
  Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
  return `/v4/traditional-liquor?${params.toString()}`;
}

function ProductView({ breweries, products, query }: { breweries: TraditionalLiquorSearchResult["breweries"]; products: ProductResult[]; query: string }) {
  return <div className="space-y-4">
    {query && breweries.length ? <section className="border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#f7c76b]" /><h2 className="text-sm font-bold">양조장 검색 결과</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2">{breweries.map((brewery) => <div key={brewery.id} className="border-l-2 border-[#f7c76b] bg-black/15 px-4 py-3"><p className="font-semibold text-white">{brewery.name}</p><p className="mt-1 text-xs text-[#f7c76b]">{brewery.region}</p><p className="mt-2 text-sm leading-6 text-white/52">{brewery.description}</p></div>)}</div></section> : null}
    {products.map((product) => <ProductSection key={product.id} product={product} />)}
  </div>;
}

function ProductSection({ product }: { product: ProductResult }) {
  const platformGroups = Array.from(new Map(product.offers.map((offer) => [offer.platformId, offer.platform])).entries());
  const minimumPrice = product.offers.length ? Math.min(...product.offers.map((offer) => offer.price)) : null;
  const sellerCount = new Set(product.offers.map((offer) => offer.sellerId)).size;
  return <article className="border border-white/10 bg-white/[0.035]">
    <header className="grid gap-5 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
      <div><div className="flex items-center gap-2"><PackageSearch className="h-4 w-4 text-[#f7c76b]" /><p className="text-xs font-bold text-[#f7c76b]">{product.category} · {product.subCategory}</p></div><h2 className="mt-2 text-2xl font-semibold text-white">{product.name}</h2><p className="mt-3 text-sm leading-6 text-white/52">{product.description}</p></div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3"><DataFact label="제조사" value={product.brewery?.name ?? "확인되지 않음"} /><DataFact label="주종" value={product.subCategory || "-"} /><DataFact label="도수" value={product.abv ? `${product.abv}%` : "-"} /><DataFact label="용량" value={product.volumeMl ? `${product.volumeMl}ml` : "-"} /><DataFact label="최저가" value={minimumPrice === null ? "-" : formatPrice(minimumPrice)} /><DataFact label="플랫폼 / 업체" value={`${platformGroups.length} / ${sellerCount}`} /></dl>
    </header>
    <div className="p-5"><p className="text-xs font-bold tracking-[0.12em] text-white/38">판매 현황</p><div className="mt-4 space-y-5">{platformGroups.map(([platformId, platform]) => <div key={platformId}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-[#f7c76b]">{platform?.name ?? "플랫폼 미확인"}</h3><span className="text-xs text-white/35">{product.offers.filter((offer) => offer.platformId === platformId).length} offers</span></div><OfferTable offers={product.offers.filter((offer) => offer.platformId === platformId)} sellerFor={(offer) => offer.seller} /></div>)}</div></div>
  </article>;
}

function PlatformView({ platforms }: { platforms: PlatformResult[] }) {
  return <div className="space-y-4">{platforms.map((platform) => <article key={platform.id} className="border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-[#f7c76b]">PLATFORM</p><h2 className="mt-1 text-2xl font-semibold">{platform.name}</h2></div><dl className="flex gap-6"><DataFact label="등록 Offer" value={`${platform.offers.length}개`} /><DataFact label="판매 전통주" value={`${platform.productCount}개`} /><DataFact label="판매업체" value={`${platform.sellerCount}개`} /></dl></div><div className="mt-5"><PlatformOfferTable platform={platform} /></div></article>)}</div>;
}

function SellerView({ sellers }: { sellers: SellerResult[] }) {
  return <div className="space-y-4">{sellers.map((seller) => <article key={seller.id} className="border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold text-[#f7c76b]"><Store className="h-4 w-4" />SELLER</div><h2 className="mt-1 text-2xl font-semibold">{seller.name}</h2></div><dl className="flex flex-wrap gap-6"><DataFact label="취급 제품" value={`${seller.productCount}개`} /><DataFact label="판매 플랫폼" value={`${seller.platformCount}개`} /><DataFact label="평균가격" value={seller.averagePrice === null ? "-" : formatPrice(seller.averagePrice)} /></dl></div><div className="mt-5"><SellerOfferTable seller={seller} /></div></article>)}</div>;
}

function OfferTable({ offers, sellerFor }: { offers: Array<Offer & { platform: Platform | null; seller: Seller | null }>; sellerFor: (offer: Offer & { platform: Platform | null; seller: Seller | null }) => Seller | null }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/36"><tr><th className="px-3 py-2.5">업체</th><th className="px-3 py-2.5">상품 구성</th><th className="px-3 py-2.5">가격</th><th className="px-3 py-2.5">배송비</th><th className="px-3 py-2.5">확인 시각</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id} className="border-b border-white/8"><td className="px-3 py-3 font-semibold text-white/78">{sellerFor(offer)?.name ?? "업체 미확인"}</td><td className="px-3 py-3 text-white/55">{offer.volumeMl}ml × {offer.quantity}</td><td className="px-3 py-3 font-bold text-[#f7c76b]">{formatPrice(offer.price)}</td><td className="px-3 py-3 text-white/48">{offer.shippingFee ? formatPrice(offer.shippingFee) : "무료"}</td><td className="px-3 py-3 text-white/34">{formatCheckedAt(offer.lastCheckedAt)}</td></tr>)}</tbody></table></div>;
}

function PlatformOfferTable({ platform }: { platform: PlatformResult }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/36"><tr><th className="px-3 py-2.5">제품</th><th className="px-3 py-2.5">업체</th><th className="px-3 py-2.5">판매 구성</th><th className="px-3 py-2.5">가격</th></tr></thead><tbody>{platform.offers.map((offer) => <tr key={offer.id} className="border-b border-white/8"><td className="px-3 py-3 font-semibold text-white/80">{offer.product?.name ?? "제품 미확인"}</td><td className="px-3 py-3 text-white/55">{offer.seller?.name ?? "업체 미확인"}</td><td className="px-3 py-3 text-white/48">{offer.volumeMl}ml × {offer.quantity}</td><td className="px-3 py-3 font-bold text-[#f7c76b]">{formatPrice(offer.price)}</td></tr>)}</tbody></table></div>;
}

function SellerOfferTable({ seller }: { seller: SellerResult }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-xs"><thead className="border-y border-white/10 text-white/36"><tr><th className="px-3 py-2.5">제품</th><th className="px-3 py-2.5">플랫폼</th><th className="px-3 py-2.5">판매 구성</th><th className="px-3 py-2.5">가격</th></tr></thead><tbody>{seller.offers.map((offer) => <tr key={offer.id} className="border-b border-white/8"><td className="px-3 py-3 font-semibold text-white/80">{offer.product?.name ?? "제품 미확인"}</td><td className="px-3 py-3 text-white/55">{offer.platform?.name ?? "플랫폼 미확인"}</td><td className="px-3 py-3 text-white/48">{offer.volumeMl}ml × {offer.quantity}</td><td className="px-3 py-3 font-bold text-[#f7c76b]">{formatPrice(offer.price)}</td></tr>)}</tbody></table></div>;
}

function DataFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/34">{label}</dt><dd className="mt-1 text-sm font-semibold text-white/72">{value}</dd></div>; }
function StateMessage({ icon, label, onRetry }: { icon?: React.ReactNode; label: string; onRetry?: () => void }) { return <div className="flex min-h-48 flex-col items-center justify-center gap-3 border border-white/10 bg-white/[0.025] text-center text-sm text-white/45"><span className="inline-flex items-center gap-3">{icon}{label}</span>{onRetry ? <button type="button" onClick={onRetry} className="border border-[#f7c76b]/45 px-3 py-2 text-xs font-bold text-[#f7c76b]">다시 시도</button> : null}</div>; }
function formatPrice(value: number) { return `${new Intl.NumberFormat("ko-KR").format(value)}원`; }
function formatCheckedAt(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
