import type { Metadata } from "next";
import { BookOpenText, Boxes, GalleryVerticalEnd } from "lucide-react";
import { ActivityPreviewCard } from "@/components/ActivityPreviewCard";
import { DashboardCard } from "@/components/DashboardCard";
import { GoodsPreviewCard } from "@/components/GoodsPreviewCard";
import { HeroSection } from "@/components/HeroSection";
import { SectionHeader } from "@/components/SectionHeader";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.name
  },
  description:
    "K_LINE is a campus K-culture hub connecting Korean cultural projects, goods, and student activities.",
  keywords: seoKeywords,
  openGraph: {
    title: "K_LINE | Goods, K-Culture Projects, and Our Activities",
    description:
      "A clean campus K-culture dashboard for Goods, K-Culture Project, and Our Activities.",
    url: siteConfig.url
  }
};

const dashboardSections = [
  {
    title: "Goods",
    koreanTitle: "상품",
    description:
      "Explore and purchase cultural goods based on Korean traditional aesthetics, Hanji, calligraphy, and Korean archery.",
    href: "/goods",
    action: "Explore Goods",
    icon: Boxes
  },
  {
    title: "K-Culture Project",
    koreanTitle: "K-컬처 프로젝트",
    description:
      "Discover and share cultural projects connecting Korea, Jeonbuk, Hanji, calligraphy, Korean archery, and global exchange.",
    href: "/k-culture-project",
    action: "View Projects",
    icon: GalleryVerticalEnd
  },
  {
    title: "Our Activities",
    koreanTitle: "우리의 활동들",
    description:
      "Read and share activity records, news-style posts, reviews, field notes, and community stories.",
    href: "/our-activities",
    action: "Read Activities",
    icon: BookOpenText
  }
];

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Three main tracks"
            title="A simple dashboard for campus K-culture"
            description="K_LINE keeps the experience focused on three paths: cultural goods, student-friendly K-culture projects, and community activities."
            align="center"
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {dashboardSections.map((section) => (
              <DashboardCard key={section.title} {...section} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/55 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Community activities"
            title="Meet the student activity boards"
            description="ECC and Han-hwal give students a place to share activity records, photos, questions, and campus stories."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {activityBoards.map((board, index) => (
              <ActivityPreviewCard
                key={board.id}
                board={board}
                accent={index === 0 ? "gold" : "green"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <SectionHeader
              eyebrow="Featured goods"
              title="Compact cultural objects for campus life"
              description="A refined preview of K_LINE goods connected to Hanji, Korean calligraphy, and Han-hwal."
            />
            <p className="max-w-xl text-sm leading-7 text-muted md:justify-self-end">
              Goods remain inquiry-based while payment and inventory systems are prepared.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {goods.slice(0, 2).map((item) => (
              <GoodsPreviewCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
