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
  gold: "bg-brass",
  green: "bg-pine"
};

const bannerClass = {
  ecc: "bg-[#5547a3] text-paper",
  hanhwal: "bg-navy text-paper"
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
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
          <div className="absolute -left-20 -top-28 h-72 w-72 rounded-full border-[34px] border-white/12" />
          <div className="absolute -right-20 bottom-6 h-52 w-52 rounded-full border border-brass/30" />
        </div>
        <div className="relative flex h-full min-h-56 items-center justify-between gap-5 p-6 md:p-8">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              <I18nText en="International Club" ko="국제 학생 클럽" />
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <h3 className="font-serif text-5xl font-semibold leading-none md:text-6xl">
                {title}
              </h3>
              <span className="h-px w-14 bg-brass md:w-20" aria-hidden="true" />
            </div>
            <p className="mt-5 text-sm font-semibold text-paper/70">
              {language === "ko" ? `${title} 전체` : `${title} Overview`}
            </p>
          </div>
          <ClubMark
            id={board.id}
            size="xl"
            className="border-4 border-white/80 bg-white shadow-lift transition duration-500 group-hover:scale-105"
          />
          <span className={`absolute bottom-0 left-0 h-1 w-full ${accentClass[accent]}`} aria-hidden="true" />
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
