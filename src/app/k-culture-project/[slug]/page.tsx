import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTAButton } from "@/components/CTAButton";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectContributionBoard } from "@/components/ProjectContributionBoard";
import { SectionHeader } from "@/components/SectionHeader";
import { TagBadge } from "@/components/TagBadge";
import { getProjectBySlug, projects } from "@/data/projects";
import { absoluteUrl, seoKeywords, siteConfig } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {
      title: "K-Culture Project"
    };
  }

  return {
    title: project.englishTitle,
    description: project.shortDescription,
    keywords: seoKeywords,
    alternates: {
      canonical: `${siteConfig.url}/k-culture-project/${project.slug}`
    },
    openGraph: {
      title: `${project.englishTitle} | ${siteConfig.name}`,
      description: project.shortDescription,
      url: `${siteConfig.url}/k-culture-project/${project.slug}`,
      siteName: siteConfig.name,
      images: [
        {
          url: project.image.src,
          alt: project.image.alt
        }
      ],
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.englishTitle} | ${siteConfig.name}`,
      description: project.shortDescription,
      images: [project.image.src]
    }
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const relatedProjects = projects.filter((item) => item.slug !== project.slug).slice(0, 2);
  const projectJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.englishTitle,
    alternateName: project.title,
    description: project.shortDescription,
    image: absoluteUrl(project.image.src),
    author: {
      "@type": "Organization",
      name: project.teamOrAuthor
    },
    about: project.tags
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectJsonLd) }}
      />
      <section className="bg-ink py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <CategoryBadge label={project.category} />
            <h1 className="mt-5 font-serif text-5xl font-semibold md:text-7xl">{project.title}</h1>
            <p className="mt-4 text-2xl font-semibold text-paper/88">{project.englishTitle}</p>
            <p className="mt-6 text-lg leading-8 text-paper/72">{project.shortDescription}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <TagBadge key={tag} label={tag} />
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden bg-hanji">
            <Image
              src={project.image.src}
              alt={project.image.alt}
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1fr_320px] md:px-8">
          <div className="grid gap-8">
            <article className="paper-panel overflow-hidden">
              {project.detailImage ? (
                <div className="relative aspect-[16/9] bg-hanji">
                  <Image
                    src={project.detailImage.src}
                    alt={project.detailImage.alt}
                    fill
                    sizes="(min-width: 768px) 70vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="p-6 md:p-8">
                <h2 className="font-serif text-4xl font-semibold text-ink">London Project Space</h2>
                <p className="mt-6 text-base leading-8 text-ink/72">{project.fullDescription}</p>
                <div className="mt-8">
                  <CTAButton href="/contact">Contact or Inquiry</CTAButton>
                </div>
              </div>
            </article>
            <ProjectContributionBoard projectId={project.id} />
          </div>
          <aside className="paper-panel h-fit p-6">
            <h2 className="font-serif text-2xl font-semibold text-ink">Project Info</h2>
            <dl className="mt-5 grid gap-3 text-sm text-ink/68">
              <div>
                <dt className="font-semibold text-ink">Team / Author</dt>
                <dd>{project.teamOrAuthor}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Location</dt>
                <dd>{project.location}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Date</dt>
                <dd>{project.date}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {relatedProjects.length > 0 ? (
        <section className="bg-white/50 py-14 md:py-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <SectionHeader
              eyebrow="Related projects"
              title="Continue through the K-culture archive"
              description="Explore more project records and community bases within K_LINE."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {relatedProjects.map((item) => (
                <ProjectCard key={item.id} project={item} />
              ))}
            </div>
            <Link
              href="/k-culture-project"
              className="mt-8 inline-flex text-sm font-semibold text-ink underline underline-offset-4"
            >
              Back to K-Culture Project
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
