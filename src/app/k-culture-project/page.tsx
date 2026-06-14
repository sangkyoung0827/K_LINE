import type { Metadata } from "next";
import { CTAButton } from "@/components/CTAButton";
import { I18nText } from "@/components/LanguageProvider";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeader } from "@/components/SectionHeader";
import { projects } from "@/data/projects";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "K-Culture Project",
  description:
    "K_LINE K-Culture Project introduces student-made international Korean culture projects and campus cultural exchange.",
  path: "/k-culture-project",
  keywords: ["Korean culture project", "K-Culture Project", "international students"]
});

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
                en="Student-made international projects."
                ko="학생들이 만들어나가는 국제적 프로젝트들"
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
                en="Student-made international projects."
                ko="학생들이 만들어나가는 국제적 프로젝트들"
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
