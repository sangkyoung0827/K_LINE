import type { Metadata } from "next";
import { CTAButton } from "@/components/CTAButton";
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
            <p className="text-sm font-semibold uppercase text-brass">Project platform</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
              K-Culture Project
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              Discover and share cultural projects connecting Korea, Jeonbuk, Hanji, Korean
              calligraphy, Korean traditional archery, and global exchange.
            </p>
          </div>
          <CTAButton href="/k-culture-project/submit" variant="light">
            Submit Project
          </CTAButton>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Project list"
            title="Cultural projects and community bases"
            description="Han-hwal has moved from the top-level menu into this K-Culture Project section as a project page."
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
