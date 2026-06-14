import type { Metadata } from "next";
import { GoodsCard } from "@/components/GoodsCard";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { goods } from "@/data/goods";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "Goods",
  description:
    "Explore K_LINE K-culture goods and cultural objects connected to Hanji, Korean calligraphy, Dangun myth, dancheong, najeonchilgi, Kim Hongdo, Korean traditional archery, and campus culture.",
  path: "/goods",
  keywords: [
    "K-culture goods",
    "Korean cultural objects",
    "Dangun myth mug set",
    "Dancheong mug set",
    "Najeonchilgi plate",
    "Kim Hongdo blanket",
    "Hanji",
    "Korean calligraphy",
    "Korean traditional goods"
  ]
});

export default function GoodsPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-hanji text-ink">
        <div className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
          <img
            src="/images/goods-hero-clean.jpg"
            alt="Korean heritage lifestyle goods including a dancheong mug, calligraphy light object, najeonchilgi plate, fan, blanket, and keyrings"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-y-0 left-0 w-52 bg-gradient-to-r from-hanji to-transparent" />
          <div className="absolute inset-0 bg-hanji/10" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(214,168,90,0.18),transparent_34%),linear-gradient(90deg,#F4EBDD_0%,#F4EBDD_42%,rgba(244,235,221,0.78)_62%,rgba(244,235,221,0.18)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-hanji to-transparent" />
        <div className="relative mx-auto flex min-h-[460px] max-w-7xl items-center px-5 py-16 md:min-h-[560px] md:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="K_LINE Goods" ko="K_LINE 상품" />
            </p>
            <h1 className="mt-4 break-keep font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl md:text-6xl">
              <I18nText en="Korean Heritage for Everyday Life" ko="한국의 유산을 일상과 함께" />
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-ink/72 md:text-lg">
              <I18nText
                en="Hanji, dancheong, najeonchilgi, traditional motifs, and modern lifestyle goods."
                ko="한지, 단청, 나전칠기, 전통 문양을 오늘의 라이프스타일 굿즈로 소개합니다."
              />
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-normal text-ink/64">
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Korean heritage" ko="한국 유산" />
              </span>
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Crafted objects" ko="문화 오브젝트" />
              </span>
              <span className="border border-brass/35 bg-white/45 px-3 py-2">
                <I18nText en="Made for everyday" ko="일상을 위한 굿즈" />
              </span>
            </div>
            <div className="mt-10 overflow-hidden border border-brass/25 bg-white/35 shadow-soft md:hidden">
              <img
                src="/images/goods-hero-clean.jpg"
                alt="Korean heritage lifestyle goods"
                decoding="async"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Cultural objects" ko="문화 오브젝트" />}
            title={<I18nText en="Cultural objects with a Korean line" ko="한국의 선을 담은 문화 오브젝트" />}
            description={
              <I18nText
                en="Each card includes the product image, story, inquiry price placeholder, detail page, and cart inquiry action."
                ko="각 카드에는 상품 이미지, 이야기, 가격 안내, 상세 보기, 장바구니 문의 기능이 포함됩니다."
              />
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {goods.map((item) => (
              <GoodsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
