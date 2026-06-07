import type { Metadata } from "next";
import { GoodsCard } from "@/components/GoodsCard";
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
          <p className="text-sm font-semibold uppercase text-brass">Goods</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">K_LINE Goods</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
            Goods are presented as cultural products connected to Hanji, Korean calligraphy,
            Korean traditional archery, and Jeonbuk K-culture. This is inquiry-based commerce
            before real payment integration.
          </p>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Initial goods"
            title="Cultural objects with a Korean line"
            description="Each card includes a product image, English and Korean names, description, price placeholder, details, and cart inquiry action."
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
