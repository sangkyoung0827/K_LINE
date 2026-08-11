"use client";

import { ArrowLeft, Building2, Database, LoaderCircle, PackageSearch, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { traditionalLiquorService } from "@/lib/traditional-liquor/service";
import { TraditionalLiquorCollectionPanel } from "@/components/traditional-liquor/TraditionalLiquorCollectionPanel";
import type { Offer, Platform, PlatformResult, ProductResult, Seller, SellerResult, TraditionalLiquorSearchResult, TraditionalLiquorView } from "@/lib/traditional-liquor/types";

const tabs: Array<{ id: TraditionalLiquorView; label: string }> = [
  { id: "product", label: "제품별" },
  { id: "platform", label: "플랫폼별" },
  { id: "seller", label: "업체별" }
];

export function TraditionalLiquorDatabase({ onBack }: { onBack?: () => void }) {
  const [activeView, setActiveView] = useState<TraditionalLiquorView>("product");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TraditionalLiquorSearchResult | null>(null);
  const [status, setStatus] = useState<"initial" | "loading" | "success" | "empty" | "error">("initial");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setStatus("loading");
      traditionalLiquorService.search(query).then((nextResults) => {
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
  }, [query]);

  const visibleCount = useMemo(() => {
    if (!results) return 0;
    if (activeView === "product") return results.products.length;
    if (activeView === "platform") return results.platforms.length;
    return results.sellers.length;
  }, [activeView, results]);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {onBack ? <button type="button" onClick={onBack} className="mb-5 inline-flex h-9 items-center gap-2 border border-white/15 px-3 text-xs font-semibold text-white/65 transition hover:border-[#f7c76b]/60 hover:text-[#f7c76b]"><ArrowLeft className="h-4 w-4" />우혁몬 4.0으로 돌아가기</button> : null}
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-[#f7c76b]"><Database className="h-4 w-4" />STRUCTURED MARKET DATA</div>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">전통주 DATABASE</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/56">제품, 판매 플랫폼, 판매업체의 관계를 조회하는 우혁몬 4.0 전통주 시장 데이터 모듈입니다.</p>
        </div>
        <span className="border border-[#f7c76b]/30 bg-[#f7c76b]/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-[#f7c76b]">LOCAL SAMPLE DATA</span>
      </div>

      <section className="mt-8 border border-white/10 bg-white/[0.035]">
        <div className="flex overflow-x-auto border-b border-white/10" role="tablist" aria-label="전통주 데이터 분류">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeView === tab.id} onClick={() => setActiveView(tab.id)} className={`min-h-12 min-w-28 border-r border-white/10 px-5 text-sm font-bold transition ${activeView === tab.id ? "bg-[#f7c76b] text-[#17191a]" : "text-white/58 hover:bg-white/5 hover:text-white"}`}>{tab.label}</button>)}
        </div>
        <div className="p-4 md:p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="전통주, 플랫폼, 업체를 검색하세요" className="h-12 w-full border border-white/15 bg-[#0e1112] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[#f7c76b]" />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/38"><span>PRODUCT · PLATFORM · SELLER · BREWERY 통합 검색</span><span>{status === "loading" ? "검색 중" : `${visibleCount}개 결과`}</span></div>
        </div>
      </section>

      <section className="mt-4">
        {status === "initial" || status === "loading" ? <StateMessage icon={<LoaderCircle className="h-5 w-5 animate-spin" />} label="전통주 데이터를 불러오는 중입니다." /> : null}
        {status === "error" ? <StateMessage label={error || "데이터를 불러오지 못했습니다."} /> : null}
        {status === "empty" || (status === "success" && visibleCount === 0) ? <StateMessage label="검색 결과가 없습니다." /> : null}
        {status === "success" && results ? <>
          {activeView === "product" ? <ProductView products={results.products} query={query} breweries={results.breweries} /> : null}
          {activeView === "platform" ? <PlatformView platforms={results.platforms} /> : null}
          {activeView === "seller" ? <SellerView sellers={results.sellers} /> : null}
        </> : null}
      </section>
      <TraditionalLiquorCollectionPanel />
    </main>
  );
}

function ProductView({ breweries, products, query }: { breweries: TraditionalLiquorSearchResult["breweries"]; products: ProductResult[]; query: string }) {
  return <div className="space-y-4">
    {query && breweries.length ? <section className="border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#f7c76b]" /><h2 className="text-sm font-bold">양조장 검색 결과</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2">{breweries.map((brewery) => <div key={brewery.id} className="border-l-2 border-[#f7c76b] bg-black/15 px-4 py-3"><p className="font-semibold text-white">{brewery.name}</p><p className="mt-1 text-xs text-[#f7c76b]">{brewery.region}</p><p className="mt-2 text-sm leading-6 text-white/52">{brewery.description}</p></div>)}</div></section> : null}
    {products.map((product) => <ProductSection key={product.id} product={product} />)}
  </div>;
}

function ProductSection({ product }: { product: ProductResult }) {
  const platformGroups = Array.from(new Map(product.offers.map((offer) => [offer.platformId, offer.platform])).entries());
  return <article className="border border-white/10 bg-white/[0.035]">
    <header className="grid gap-5 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
      <div><div className="flex items-center gap-2"><PackageSearch className="h-4 w-4 text-[#f7c76b]" /><p className="text-xs font-bold text-[#f7c76b]">{product.category} · {product.subCategory}</p></div><h2 className="mt-2 text-2xl font-semibold text-white">{product.name}</h2><p className="mt-3 text-sm leading-6 text-white/52">{product.description}</p></div>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3"><DataFact label="제조사" value={product.brewery?.name ?? "확인되지 않음"} /><DataFact label="지역" value={product.region} /><DataFact label="주종" value={product.subCategory} /><DataFact label="도수" value={`${product.abv}%`} /><DataFact label="용량" value={`${product.volumeMl}ml`} /></dl>
    </header>
    <div className="p-5"><p className="text-xs font-bold tracking-[0.12em] text-white/38">판매 현황</p><div className="mt-4 space-y-5">{platformGroups.map(([platformId, platform]) => <div key={platformId}><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-[#f7c76b]">{platform?.name ?? "플랫폼 미확인"}</h3><span className="text-xs text-white/35">{product.offers.filter((offer) => offer.platformId === platformId).length} offers</span></div><OfferTable offers={product.offers.filter((offer) => offer.platformId === platformId)} sellerFor={(offer) => offer.seller} /></div>)}</div></div>
  </article>;
}

function PlatformView({ platforms }: { platforms: PlatformResult[] }) {
  return <div className="space-y-4">{platforms.map((platform) => <article key={platform.id} className="border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-[#f7c76b]">PLATFORM</p><h2 className="mt-1 text-2xl font-semibold">{platform.name}</h2></div><dl className="flex gap-6"><DataFact label="판매 전통주" value={`${platform.productCount}개`} /><DataFact label="판매업체" value={`${platform.sellerCount}개`} /></dl></div><div className="mt-5"><PlatformOfferTable platform={platform} /></div></article>)}</div>;
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
function StateMessage({ icon, label }: { icon?: React.ReactNode; label: string }) { return <div className="flex min-h-48 items-center justify-center gap-3 border border-white/10 bg-white/[0.025] text-sm text-white/45">{icon}{label}</div>; }
function formatPrice(value: number) { return `${new Intl.NumberFormat("ko-KR").format(value)}원`; }
function formatCheckedAt(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
