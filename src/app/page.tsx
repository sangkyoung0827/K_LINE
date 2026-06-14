import type { Metadata } from "next";
import { BookOpenText, Boxes, GalleryVerticalEnd } from "lucide-react";
import { ActivityPreviewCard } from "@/components/ActivityPreviewCard";
import { DashboardCard } from "@/components/DashboardCard";
import { GoodsPreviewCard } from "@/components/GoodsPreviewCard";
import { HeroSection } from "@/components/HeroSection";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: siteConfig.title
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: "/images/k-line-hero.jpg",
        width: 1600,
        height: 840,
        alt: "K_LINE campus K-culture hub"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/images/k-line-hero.jpg"]
  },
  alternates: {
    canonical: siteConfig.url
  },
  verification: {
    google: ["googlefd1a14b874829389.html", "fd1a14b874829389"]
  },
  robots: {
    index: true,
    follow: true
  }
};

const dashboardSections = [
  {
    title: "International Clubs",
    eyebrow: <I18nText en="International Clubs" ko="국제 학생 클럽" />,
    description:
      <I18nText
        en="Read and share club records, news-style posts, reviews, field notes, and community stories."
        ko="클럽 기록, 소식, 후기, 현장 노트, 커뮤니티 이야기를 읽고 공유합니다."
      />,
    href: "/our-activities",
    action: <I18nText en="View Clubs" ko="클럽 보기" />,
    icon: BookOpenText
  },
  {
    title: "Goods",
    eyebrow: <I18nText en="Goods" ko="상품" />,
    description:
      <I18nText
        en="Explore cultural goods based on Korean traditional aesthetics, Hanji, calligraphy, and Korean archery."
        ko="한지, 서예, 국궁 등 한국적 미감을 바탕으로 한 문화 상품을 살펴봅니다."
      />,
    href: "/goods",
    action: <I18nText en="Explore Goods" ko="상품 보기" />,
    icon: Boxes
  },
  {
    title: "K-Culture Project",
    eyebrow: <I18nText en="K-Culture Project" ko="K-컬처 프로젝트" />,
    description:
      <I18nText
        en="Student-made international projects."
        ko="학생들이 만들어나가는 국제적 프로젝트들"
      />,
    href: "/k-culture-project",
    action: <I18nText en="View Projects" ko="프로젝트 보기" />,
    icon: GalleryVerticalEnd
  }
];

export default function HomePage() {
  return (
    <>
      <HeroSection />

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Three main tracks" ko="세 가지 주요 흐름" />}
            title={<I18nText en="Dashboard" ko="Dashboard" />}
            description={
              <I18nText
                en="K_LINE keeps the experience focused on three paths: cultural goods, student-friendly K-culture projects, and international student clubs."
                ko="K_LINE은 문화 상품, 학생 친화형 K-컬처 프로젝트, 국제 학생 클럽이라는 세 가지 길에 집중합니다."
              />
            }
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
            eyebrow={<I18nText en="International clubs" ko="국제 학생 클럽" />}
            title={<I18nText en="Meet the student clubs" ko="학생 클럽 전체를 만나보세요" />}
            description={
              <I18nText
                en="ECC and Hanhwal give students a place to share club records, photos, questions, and campus stories."
                ko="ECC와 한활은 학생들이 활동 기록, 사진, 질문, 캠퍼스 이야기를 나누는 공간입니다."
              />
            }
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
              eyebrow={<I18nText en="Featured goods" ko="대표 상품" />}
              title={<I18nText en="Cultural Objects" ko="문화 오브젝트" />}
              description={
                <I18nText
                  en="A refined preview of K_LINE goods connected to Hanji, Korean calligraphy, Dangun myth, dancheong, najeonchilgi, Kim Hongdo, and Hanhwal."
                  ko="한지, 서예, 단군신화, 단청, 나전칠기, 김홍도, 한활과 연결된 K_LINE 상품을 소개합니다."
                />
              }
            />
            <p className="max-w-xl text-sm leading-7 text-muted md:justify-self-end">
              <I18nText
                en="Goods remain inquiry-based while payment and inventory systems are prepared."
                ko="결제와 재고 시스템이 준비되기 전까지 상품은 문의 기반으로 운영됩니다."
              />
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {goods.map((item) => (
              <GoodsPreviewCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
