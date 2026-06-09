import type { Metadata } from "next";
import { GoodsCard } from "@/components/GoodsCard";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { goods } from "@/data/goods";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Goods",
  description:
    "Shop K_LINE Goods including Hanji Calligraphy LED Light Object and Arrow Pen through inquiry-based commerce.",
  keywords: seoKeywords,
  openGraph: {
    title: "Goods | K_LINE",
    description:
      "K-culture goods and Korean traditional goods connected to Hanji, Korean calligraphy, 국궁, 한활, and Jeonbuk K-culture."
  }
};

export default function GoodsPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <p className="text-sm font-semibold uppercase text-brass">
            <I18nText en="Goods" ko="상품" />
          </p>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
            <I18nText en="K_LINE Goods" ko="K_LINE 상품" />
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
            <I18nText
              en="Goods are presented as cultural products connected to Hanji, Korean calligraphy, Korean traditional archery, and Jeonbuk K-culture. This is inquiry-based commerce before real payment integration."
              ko="상품은 한지, 서예, 국궁, 전북 K-컬처와 연결된 문화 상품으로 소개됩니다. 실제 결제 연동 전까지 문의 기반으로 운영됩니다."
            />
          </p>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Initial goods" ko="초기 상품" />}
            title={<I18nText en="Cultural objects with a Korean line" ko="한국의 선을 담은 문화 오브젝트" />}
            description={
              <I18nText
                en="Each card includes a product image, description, price placeholder, details, and cart inquiry action."
                ko="각 카드에는 상품 이미지, 설명, 가격 안내, 상세 보기, 장바구니 문의 기능이 포함됩니다."
              />
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {goods.map((item) => (
              <GoodsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
