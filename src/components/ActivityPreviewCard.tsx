"use client";

import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import type { FreeBoard } from "@/types";

type ActivityPreviewCardProps = {
  board: FreeBoard;
  accent: "gold" | "green";
};

const accentClass = {
  gold: "bg-brass text-ink",
  green: "bg-pine text-paper"
};

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
      <div className="relative min-h-48 overflow-hidden bg-navy">
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-8 top-10 h-px w-48 origin-left -rotate-12 bg-paper/24" />
          <div className="absolute right-8 top-8 h-px w-28 origin-left rotate-12 bg-paper/18" />
          <div className="absolute bottom-8 left-8 h-1 w-48 origin-left -rotate-12 bg-brass" />
          <div className="absolute bottom-14 left-14 h-1 w-32 origin-left -rotate-12 bg-pine" />
        </div>
        <div className="relative flex h-full min-h-48 items-end justify-between p-6 text-paper">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{title}</p>
            <h3 className="mt-3 font-serif text-4xl font-semibold">
              {language === "ko" ? `${title} 게시판` : `${title} Board`}
            </h3>
          </div>
          <span className={`flex h-12 w-12 items-center justify-center ${accentClass[accent]}`}>
            <UsersRound aria-hidden className="h-5 w-5" />
          </span>
        </div>
      </div>
      <div className="grid gap-4 p-6">
        <p className="text-sm font-semibold text-muted">
          <I18nText en="International club board" ko="국제 학생 클럽 게시판" />
        </p>
        <p className="text-sm leading-7 text-ink/70">{description}</p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <I18nText en="Open Club Board" ko="게시판 열기" />
          <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
