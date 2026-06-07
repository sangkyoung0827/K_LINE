import type { Metadata } from "next";
import { BookOpenText, Boxes, GalleryVerticalEnd } from "lucide-react";
import { DashboardCard } from "@/components/DashboardCard";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Home",
  description:
    "K_LINE is a clean three-section dashboard for Korean cultural goods, K-culture projects, and community activity records.",
  keywords: seoKeywords,
  openGraph: {
    title: "K_LINE | Goods, K-Culture Projects, and Our Activities",
    description:
      "A modern Korean cultural platform dashboard for Goods, K-Culture Project, and Our Activities.",
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
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase text-brass">K_LINE Dashboard Platform</p>
          <h1 className="mt-5 font-serif text-5xl font-semibold text-ink md:text-7xl">
            A clean cultural dashboard for Korean lines.
          </h1>
          <p className="mt-5 text-2xl font-semibold text-ink/76">한국의 선, 유럽을 잇다</p>
          <p className="mt-6 max-w-3xl text-base leading-8 text-ink/68 md:text-lg">
            K_LINE is organized into three clear sections: Goods, K-Culture Project, and
            Our Activities. It is a cultural platform and archive, not a crowded online shop.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {dashboardSections.map((section) => (
            <DashboardCard key={section.title} {...section} />
          ))}
        </div>
      </div>
    </section>
  );
}
