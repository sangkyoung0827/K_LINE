import type { Metadata } from "next";
import { CTAButton } from "@/components/CTAButton";
import { I18nText } from "@/components/LanguageProvider";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { projects } from "@/data/projects";
import { seoKeywords } from "@/lib/seo";

export const metadata: Metadata = {
  title: "K-Culture Project",
  description:
    "Explore K_LINE K-culture projects including Connecting Korean Lines to Europe and Han-hwal.",
  keywords: seoKeywords,
  openGraph: {
    title: "K-Culture Project | K_LINE",
    description:
      "A project platform for Jeonbuk K-culture, Hanji, Korean calligraphy, Korean traditional archery, and global exchange."
  }
};

export default function KCultureProjectPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="Project platform" ko="프로젝트 플랫폼" />
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
              <I18nText en="K-Culture Project" ko="K-컬처 프로젝트" />
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              <I18nText
                en="Discover and share cultural projects connecting Korea, Jeonbuk, Hanji, Korean calligraphy, Korean traditional archery, and global exchange."
                ko="한국, 전북, 한지, 서예, 국궁, 국제 교류를 연결하는 문화 프로젝트를 발견하고 공유합니다."
              />
            </p>
          </div>
          <CTAButton href="/k-culture-project/submit" variant="light">
            <I18nText en="Submit Project" ko="프로젝트 제출" />
          </CTAButton>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Project list" ko="프로젝트 목록" />}
            title={<I18nText en="Cultural projects and community bases" ko="문화 프로젝트와 커뮤니티 기반" />}
            description={
              <I18nText
                en="Hanhwal has moved from the top-level menu into this K-Culture Project section as a project page."
                ko="한활은 상단 단독 메뉴가 아니라 K-컬처 프로젝트 안의 프로젝트 페이지로 이동했습니다."
              />
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
