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

export function ActivityPreviewCard({ board }: ActivityPreviewCardProps) {
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
      className="paper-panel group grid overflow-hidden p-6 shadow-[0_18px_45px_rgba(31,42,68,0.06)] transition duration-200 hover:-translate-y-1 hover:border-brass/70 hover:bg-white/78 hover:shadow-[0_22px_55px_rgba(31,42,68,0.10)] md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <ClubMark
          id={board.id}
          size="lg"
          className="border-4 border-white bg-white shadow-[0_14px_28px_rgba(31,42,68,0.12)]"
        />
        <span className="rounded-full bg-hanji/80 px-3 py-1 text-xs font-bold text-navy/80">
          <I18nText en="International" ko={board.id === "ecc" ? "International" : "국궁 Traditional"} />
        </span>
      </div>

      <div className="mt-8">
        <h3 className="font-serif text-4xl font-semibold tracking-[-0.02em] text-navy">
          {title}
        </h3>
        <p className="mt-5 text-sm font-medium leading-7 text-muted">{description}</p>
      </div>

      <span className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-navy">
        <I18nText en="Open Club Overview" ko="자세히 보기" />
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
