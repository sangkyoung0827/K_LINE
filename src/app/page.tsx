import type { Metadata } from "next";
import Image from "next/image";
import { CTAButton } from "@/components/CTAButton";
import { GoodsCard } from "@/components/GoodsCard";
import { SectionHeader } from "@/components/SectionHeader";
import { goods } from "@/data/goods";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Home",
  description:
    "K_LINE connects Korean traditional archery, Hanji, calligraphy, digital fabrication, and cultural goods from Korea to Europe.",
  keywords: seoKeywords,
  openGraph: {
    title: "K_LINE | Connecting Korean Lines to Europe",
    description:
      "A public Korean cultural platform for Han-hwal, Korean archery classes, Jeonbuk K-culture projects, and goods.",
    url: siteConfig.url
  }
};

const features = [
  {
    title: "Han-hwal Base",
    text: "A community base for Korean traditional archery, discipline, cultural practice, and body-mind training.",
    href: "/han-hwal"
  },
  {
    title: "Korean Archery Class",
    text: "Inquiry-based classes for international students, foreign visitors, Korean students, and culture groups.",
    href: "/archery-class"
  },
  {
    title: "K-Culture Project",
    text: "Jeonbuk Hanji, Korean calligraphy, 3D printing, LED lighting, and Europe connected through design.",
    href: "/k-culture-project"
  },
  {
    title: "Goods Preview",
    text: "Cultural goods shaped by Korean lines: Hanji light object, Arrow Pen, and future exhibition shop items.",
    href: "/goods"
  }
];

export default function HomePage() {
  return (
    <>
      <section className="relative min-h-[82svh] overflow-hidden bg-ink text-paper">
        <Image
          src="/images/k-line-hero.png"
          alt="Korean traditional bow, Hanji paper, calligraphy lines, and warm LED light for K_LINE"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-ink/58" />
        <div className="relative mx-auto flex min-h-[82svh] max-w-7xl items-end px-5 pb-16 pt-24 md:px-8 md:pb-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-brass">K_LINE / Han-hwal</p>
            <h1 className="mt-5 font-serif text-5xl font-semibold text-paper md:text-7xl">
              Connecting Korean Lines to Europe
            </h1>
            <p className="mt-5 text-2xl font-semibold text-paper/92">한국의 선, 유럽을 잇다</p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-paper/76 md:text-lg">
              K_LINE connects Korean archery, Hanji, calligraphy, digital fabrication, and
              cultural goods through a public cultural platform, not a generic online shop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CTAButton href="/han-hwal" variant="light">Explore Han-hwal</CTAButton>
              <CTAButton href="/archery-class" variant="lightOutline">Book Archery Class</CTAButton>
              <CTAButton href="/goods" variant="light">Shop Goods</CTAButton>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Cultural platform"
            title="Han-hwal, archery, Hanji, and goods in one cultural line"
            description="K_LINE introduces Han-hwal as the main base, shares Korean traditional archery and martial culture, archives the Jeonbuk K-culture project, and opens inquiry-based access to cultural goods."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <a key={feature.title} href={feature.href} className="paper-panel block p-6 transition hover:border-brass hover:bg-white/60">
                <h2 className="font-serif text-2xl font-semibold text-ink">{feature.title}</h2>
                <p className="mt-4 text-sm leading-7 text-ink/68">{feature.text}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy py-14 text-paper md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Main base</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold md:text-5xl">한활 Han-hwal</h2>
          </div>
          <div className="grid gap-5 text-paper/72">
            <p className="text-lg leading-9">
              Han-hwal is the base for Korean traditional archery, discipline, body-mind
              training, and cultural exchange. It connects Korean students, international
              students, and foreign visitors through practical cultural activities.
            </p>
            <CTAButton href="/han-hwal" variant="light">Learn About Han-hwal</CTAButton>
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Goods"
            title="Cultural goods, opened through inquiry first"
            description="The first K_LINE goods are not treated as generic products. Each object carries Hanji texture, Korean calligraphy, 국궁, 한활, and Jeonbuk K-culture context."
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
