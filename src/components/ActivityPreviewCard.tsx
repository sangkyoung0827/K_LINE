"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import type { FreeBoard } from "@/types";

type ActivityPreviewCardProps = {
  board: FreeBoard;
  accent: "gold" | "green";
};

const accentClass = {
  gold: "border-brass/60 bg-brass/15",
  green: "border-pine/45 bg-pine/12"
};

const bannerClass = {
  ecc: "bg-[#5547a3]",
  hanhwal: "bg-navy"
} as const;

const glowClass = {
  ecc: "bg-[#f45055]",
  hanhwal: "bg-brass"
} as const;

export function ActivityPreviewCard({ board, accent }: ActivityPreviewCardProps) {
  const { language } = useLanguage();
  const title = board.id === "ecc" ? "ECC" : language === "ko" ? "한활" : "Hanhwal";
  const description =
    board.id === "ecc"
      ? language === "ko"
        ? "ECC 활동 기록, 사진, 질문, 자유로운 글을 공유하는 커뮤니티 공간입니다."
        : "A community space for ECC activity notes, photos, questions, and open posts."
      : language === "ko"
        ? "한활 연습 기록, 국궁 사진, 질문, 자유로운 글을 공유하는 커뮤니티 공간입니다."
        : "A community space for Hanhwal practice records, Korean archery photos, questions, and open posts.";

  return (
    <Link
      href={`/our-activities/${board.slug}`}
      className="paper-panel group grid overflow-hidden shadow-soft transition hover:-translate-y-1 hover:border-brass hover:bg-white/78 hover:shadow-lift"
    >
      <div className={`relative min-h-56 overflow-hidden ${bannerClass[board.id]}`}>
        <div className="absolute inset-0">
          <div className={`absolute -right-20 -top-24 h-64 w-64 rounded-full ${glowClass[board.id]} opacity-90`} />
          <div className="absolute -left-24 bottom-4 h-72 w-72 rounded-full border-[38px] border-paper/12" />
          <div className="absolute left-8 top-12 h-px w-56 origin-left -rotate-12 bg-paper/24" />
          <div className="absolute bottom-10 left-8 h-1 w-52 origin-left -rotate-12 bg-brass" />
          <div className="absolute bottom-16 left-14 h-1 w-36 origin-left -rotate-12 bg-pine" />
        </div>
        <ClubMark
          id={board.id}
          size="xl"
          className="absolute right-6 top-6 border-4 border-white/70 shadow-lift transition duration-500 group-hover:scale-105"
        />
        {board.id === "hanhwal" ? (
          <div className="absolute right-20 top-24 h-36 w-36 rounded-full border border-brass/45" />
        ) : null}
        <div className="relative flex h-full min-h-56 items-end justify-between p-6 text-paper">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{title}</p>
            <h3 className="mt-3 font-serif text-4xl font-semibold">
              {language === "ko" ? `${title} 전체` : `${title} Overview`}
            </h3>
          </div>
          <span className={`hidden h-12 w-12 rounded-full border md:block ${accentClass[accent]}`} />
        </div>
      </div>
      <div className="grid gap-4 p-6">
        <p className="text-sm font-semibold text-muted">
          <I18nText en="International club overview" ko="국제 학생 클럽 전체" />
        </p>
        <p className="text-sm leading-7 text-ink/70">{description}</p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <I18nText en="Open Club Overview" ko="전체 열기" />
          <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
