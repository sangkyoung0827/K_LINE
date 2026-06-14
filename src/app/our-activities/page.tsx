import type { Metadata } from "next";
import Link from "next/link";
import { ClubMark } from "@/components/ClubMark";
import { CTAButton } from "@/components/CTAButton";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { activities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { projects } from "@/data/projects";
import { createPublicMetadata } from "@/lib/seo";

const clubDisplayTitles = {
  ecc: "ECC",
  hanhwal: "Hanhwal"
} as const;

const clubBannerClass = {
  ecc: "bg-[#5547a3]",
  hanhwal: "bg-navy"
} as const;

const clubGlowClass = {
  ecc: "bg-[#f45055]",
  hanhwal: "bg-brass"
} as const;

const latestClubRecords = [
  ...projects.map((project) => ({
    id: project.id,
    title: project.englishTitle,
    category: "Project",
    date: project.date,
    author: project.teamOrAuthor,
    excerpt: project.shortDescription,
    href: `/k-culture-project/${project.slug}`,
    image: project.image,
    tags: project.tags
  })),
  ...activities.map((post) => ({
    id: post.id,
    title: post.title,
    category: post.category,
    date: post.date,
    author: post.author,
    excerpt: post.excerpt,
    href: `/our-activities/${post.slug}`,
    image: post.image,
    tags: post.tags
  }))
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const metadata: Metadata = createPublicMetadata({
  title: "International Clubs",
  description:
    "K_LINE International Clubs connects ECC, Han-hwal, international students, campus culture, and Korean cultural activities.",
  path: "/our-activities",
  keywords: ["ECC", "Han-hwal", "international students", "campus culture"]
});

export default function OurActivitiesPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="International clubs" ko="국제 학생 클럽" />
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
              <I18nText en="International Clubs" ko="국제 학생 클럽" />
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              <I18nText
                en="Read and share news, club logs, reviews, field notes, and free community posts connected to K_LINE."
                ko="K_LINE과 연결된 소식, 클럽 기록, 후기, 현장 노트, 자유로운 커뮤니티 글을 읽고 공유합니다."
              />
            </p>
          </div>
          <CTAButton href="/our-activities/write" variant="light">
            <I18nText en="Write Post" ko="글쓰기" />
          </CTAButton>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Club menus" ko="클럽 메뉴" />}
            title={<I18nText en="ECC and Hanhwal overview" ko="ECC 전체와 한활 전체" />}
            description={
              <I18nText
                en="Open the full ECC menu or the full Hanhwal space."
                ko="ECC 전체 메뉴와 한활 전체 공간으로 이동합니다."
              />
            }
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {activityBoards.map((board) => (
              <Link
                key={board.id}
                href={`/our-activities/${board.slug}`}
                className="paper-panel group grid min-h-80 overflow-hidden transition hover:border-brass hover:bg-white/65 hover:shadow-lift"
              >
                <div className={`relative min-h-48 overflow-hidden ${clubBannerClass[board.id]}`}>
                  <div className={`absolute -right-16 -top-20 h-56 w-56 rounded-full ${clubGlowClass[board.id]} opacity-90`} />
                  <div className="absolute -left-24 bottom-4 h-64 w-64 rounded-full border-[34px] border-paper/12" />
                  <div className="absolute bottom-10 left-8 h-1 w-56 origin-left -rotate-12 bg-brass" />
                  <div className="absolute left-8 top-12 h-px w-56 origin-left -rotate-12 bg-paper/24" />
                  <ClubMark
                    id={board.id}
                    size="xl"
                    className="absolute right-6 top-6 border-4 border-white/70 shadow-lift transition duration-500 group-hover:scale-105"
                  />
                  <div className="relative flex min-h-48 items-end p-6 text-paper">
                    <div>
                      <p className="text-sm font-semibold uppercase text-brass">{board.label}</p>
                      <h2 className="mt-3 font-serif text-4xl font-semibold">
                        {clubDisplayTitles[board.id]}
                      </h2>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-6">
                  <p className="text-sm leading-7 text-ink/68">
                    {board.id === "ecc" ? (
                      <I18nText
                        en="Open the full ECC space with board posts and activity applications."
                        ko="ECC 게시판과 활동 신청을 볼 수 있는 ECC 전체 공간입니다."
                      />
                    ) : (
                      <I18nText
                        en="Open the full Hanhwal space for practice records, photos, and club stories."
                        ko="한활 연습 기록, 사진, 클럽 이야기를 볼 수 있는 한활 전체 공간입니다."
                      />
                    )}
                  </p>
                  <span className="text-sm font-semibold text-ink underline underline-offset-4">
                    {board.id === "ecc" ? (
                      <I18nText en="Open ECC Overview" ko="ECC 전체 열기" />
                    ) : (
                      <I18nText en="Open Hanhwal Overview" ko="한활 전체 열기" />
                    )}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/45 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Club records" ko="클럽 기록" />}
            title={<I18nText en="Latest posts and projects" ko="최신 등록 게시글과 프로젝트" />}
            description={
              <I18nText
                en="Recently registered public posts, activity records, reviews, field notes, and projects appear first."
                ko="최근 등록된 공개 게시글, 활동 기록, 후기, 현장 노트, 프로젝트가 최신순으로 먼저 표시됩니다."
              />
            }
          />
          <div className="mt-10 grid gap-5">
            {latestClubRecords.map((record) => (
              <article
                key={record.id}
                className="paper-panel grid gap-5 overflow-hidden p-4 transition hover:border-brass hover:bg-white/65 md:grid-cols-[220px_1fr]"
              >
                <Link href={record.href} className="relative aspect-[4/3] overflow-hidden bg-hanji">
                  <img
                    src={record.image.src}
                    alt={record.image.alt}
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </Link>
                <div className="grid content-start gap-3 p-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex border border-brass/35 bg-brass/15 px-2.5 py-1 text-xs font-semibold uppercase text-ink">
                      {record.category}
                    </span>
                    <span className="text-xs text-ink/52">{record.date}</span>
                  </div>
                  <h2 className="font-serif text-3xl font-semibold text-ink">{record.title}</h2>
                  <p className="text-sm text-ink/58">By {record.author}</p>
                  <p className="text-sm leading-7 text-ink/70">{record.excerpt}</p>
                  <div className="flex flex-wrap gap-2">
                    {record.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex border border-ink/10 bg-white/50 px-2.5 py-1 text-xs font-semibold text-ink/62"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={record.href}
                    className="mt-2 inline-flex min-h-10 w-fit items-center border border-ink/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
                  >
                    <I18nText en="Open Record" ko="기록 보기" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
