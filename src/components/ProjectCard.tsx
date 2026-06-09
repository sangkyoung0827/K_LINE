"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProjectItem } from "@/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { TagBadge } from "@/components/TagBadge";

export function ProjectCard({ project }: { project: ProjectItem }) {
  const { language } = useLanguage();

  return (
    <article className="paper-panel overflow-hidden transition hover:border-brass hover:bg-white/65">
      <Link
        href={`/k-culture-project/${project.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-hanji"
      >
        <Image
          src={project.image.src}
          alt={project.image.alt}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="object-cover transition duration-500 hover:scale-105"
        />
      </Link>
      <div className="grid gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge label={project.category} />
          <span className="text-xs text-ink/52">{project.date}</span>
        </div>
        <div>
          <h2 className="font-serif text-3xl font-semibold text-ink">{project.title}</h2>
          {language === "ko" ? (
            <p className="mt-1 text-sm font-semibold text-ink/62">{project.englishTitle}</p>
          ) : null}
        </div>
        <p className="text-sm leading-7 text-ink/70">{project.shortDescription}</p>
        <dl className="grid gap-1 text-xs text-ink/58">
          <div>
            <I18nText en="Author/team" ko="작성자/팀" />: {project.teamOrAuthor}
          </div>
          <div>
            <I18nText en="Location" ko="장소" />: {project.location}
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {project.tags.slice(0, 3).map((tag) => (
            <TagBadge key={tag} label={tag} />
          ))}
        </div>
        <Link
          href={`/k-culture-project/${project.slug}`}
          className="inline-flex min-h-10 w-fit items-center border border-ink/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
        >
          <I18nText en="View Project" ko="프로젝트 보기" />
        </Link>
      </div>
    </article>
  );
}
