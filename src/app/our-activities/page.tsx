import type { Metadata } from "next";
import Link from "next/link";
import { CTAButton } from "@/components/CTAButton";
import { ActivityPostCard } from "@/components/ActivityPostCard";
import { SectionHeader } from "@/components/SectionHeader";
import { activities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { seoKeywords } from "@/lib/seo";

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
            <p className="text-sm font-semibold uppercase text-brass">Club community board</p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
              International Clubs
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              Read and share news, club logs, reviews, field notes, and free community posts
              connected to K_LINE.
            </p>
          </div>
          <CTAButton href="/our-activities/write" variant="light">
            Write Post
          </CTAButton>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Club menus"
            title="ECC and Hanhwal community spaces"
            description="ECC includes a free board, activity management, and fund management. Hanhwal includes its community free board."
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
                    {board.koreanTitle}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-ink/68">{board.description}</p>
                </div>
                <span className="mt-8 text-sm font-semibold text-ink underline underline-offset-4">
                  {board.id === "ecc" ? "Open ECC Menu" : "Open Board"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/45 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow="Club records"
            title="News, reviews, field notes, and community stories"
            description="These sample posts show the intended public article style. User submissions are pending review until backend moderation is connected."
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
