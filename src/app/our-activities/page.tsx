import type { Metadata } from "next";
import Link from "next/link";
import { CTAButton } from "@/components/CTAButton";
import { ActivityPostCard } from "@/components/ActivityPostCard";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { activities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { seoKeywords } from "@/lib/seo";

const clubDisplayTitles = {
  ecc: "ECC",
  hanhwal: "Hanhwal"
} as const;

export const metadata: Metadata = {
  title: "International Clubs",
  description:
    "Read K_LINE international club records, news-style posts, reviews, field notes, and community stories.",
  keywords: seoKeywords,
  openGraph: {
    title: "International Clubs | K_LINE",
    description:
      "A public article and community board for K_LINE international clubs, reviews, and field notes."
  }
};

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
                className="paper-panel grid min-h-56 content-between p-6 transition hover:border-brass hover:bg-white/65"
              >
                <div>
                  <p className="text-sm font-semibold uppercase text-brass">{board.label}</p>
                  <h2 className="mt-4 font-serif text-4xl font-semibold text-ink">
                    {clubDisplayTitles[board.id]}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-ink/68">
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
                </div>
                <span className="mt-8 text-sm font-semibold text-ink underline underline-offset-4">
                  {board.id === "ecc" ? (
                    <I18nText en="Open ECC Overview" ko="ECC 전체 열기" />
                  ) : (
                    <I18nText en="Open Hanhwal Overview" ko="한활 전체 열기" />
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/45 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="Club records" ko="클럽 기록" />}
            title={<I18nText en="News, reviews, field notes, and community stories" ko="소식, 후기, 현장 노트, 커뮤니티 이야기" />}
            description={
              <I18nText
                en="These sample posts show the intended public article style. User submissions are pending review until moderation is complete."
                ko="샘플 글은 공개 글 스타일을 보여줍니다. 사용자가 제출한 글은 검토가 끝날 때까지 대기 상태로 유지됩니다."
              />
            }
          />
          <div className="mt-10 grid gap-5">
            {activities.map((post) => (
              <ActivityPostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
