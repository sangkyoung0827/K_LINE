"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { SocialImpactUnionMark } from "@/components/social-impact-union/SocialImpactUnionMark";
import { socialImpactUnion } from "@/data/socialImpactUnion";

type HomeCard = {
  href: string;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  badge: { en: string; ko: string };
  accent: "ecc" | "hanhwal" | "jeju" | "siu";
};

const homeCards: HomeCard[] = [
  {
    href: "/our-activities/ecc",
    title: { en: "ECC", ko: "ECC" },
    description: {
      en: "Check and share international student club activities, news, and community updates.",
      ko: "국제 학생 클럽 활동, 소식 및 커뮤니티를 확인하고 공유합니다."
    },
    badge: { en: "International", ko: "International" },
    accent: "ecc"
  },
  {
    href: "/our-activities/hanhwal",
    title: { en: "Hanhwal", ko: "한활" },
    description: {
      en: "Hanhwal trains body and mind through Korean archery. Beginners and experienced archers learn, practice, and continue this traditional culture together.",
      ko: "한활은 국궁으로 심신을 수련하는 한국 활쏘기 모임입니다. 초보자부터 경험자까지 함께 배우고 연습하며 한국 전통 활쏘기의 문화를 이어갑니다."
    },
    badge: { en: "Traditional", ko: "국궁 Traditional" },
    accent: "hanhwal"
  },
  {
    href: socialImpactUnion.path,
    title: socialImpactUnion.title,
    description: {
      en: "Connect people and ideas to create local impact together.",
      ko: "사람과 아이디어를 연결해 지역의 새로운 변화를 만듭니다."
    },
    badge: { en: "Community", ko: "커뮤니티" },
    accent: "siu"
  },
  {
    href: "/jeju",
    title: { en: "Memory Book", ko: "추억록" },
    description: {
      en: "Make your own Korea Memory Book with places, ratings, photos, and your journey.",
      ko: "대한민국 곳곳의 장소, 별점, 사진과 여행 기록으로 자신만의 한국 추억록을 만드세요."
    },
    badge: { en: "Memory Book", ko: "추억록" },
    accent: "jeju"
  }
];

export function HomeTrackSections() {
  return (
    <section className="bg-paper px-4 pb-10 sm:px-5 sm:pb-14 md:px-8 md:pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4 md:gap-7">
          {homeCards.map((card) => (
            <HomePortalCard key={card.href} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomePortalCard({ card }: { card: HomeCard }) {
  const { pick } = useLanguage();

  return (
    <Link
      href={card.href}
      className="group relative grid min-h-24 grid-cols-[44px_minmax(0,1fr)_20px] items-center gap-3 rounded-lg border border-navy/10 bg-white/58 p-4 text-left transition duration-200 hover:border-brass/70 hover:bg-white/78 sm:flex sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-xl sm:p-5 sm:shadow-[0_18px_45px_rgba(31,42,68,0.06)] md:min-h-[292px] md:rounded-2xl md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        {card.accent === "jeju" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#dcefe8] text-[#0d5962] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16">
            <BookOpen aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
        ) : card.accent === "siu" ? (
          <SocialImpactUnionMark className="h-11 w-11 border-4 border-white shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16" />
        ) : (
          <ClubMark
            id={card.accent === "ecc" ? "ecc" : "hanhwal"}
            size="md"
            className="!h-11 !w-11 border-4 border-white bg-white shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:!h-16 sm:!w-16"
          />
        )}

        <span className="hidden rounded-full bg-hanji/80 px-3 py-1 text-xs font-bold text-navy/80 sm:inline">
          {pick(card.badge)}
        </span>
      </div>

      <div className="min-w-0 flex-1 sm:mt-6 md:mt-8">
        <h2 className="font-serif text-xl font-semibold tracking-normal text-navy sm:text-3xl md:text-4xl">
          {pick(card.title)}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted sm:hidden">
          {card.accent === "ecc" ? <I18nText en="Membership & activities" ko="회원 등록 · 활동 신청" /> : card.accent === "hanhwal" ? <I18nText en="Traditional archery club" ko="전통 국궁 동아리" /> : card.accent === "siu" ? <I18nText en="People, ideas & local impact" ko="사람 · 아이디어 · 지역의 변화" /> : <I18nText en="Places, memories & WooHyukmon" ko="지도 · 여행 기록 · 우혁몬" />}
        </p>
        <p className="mt-2 hidden text-sm font-medium leading-6 text-muted sm:mt-4 sm:block sm:leading-7 md:mt-6 md:min-h-[4.5rem]">
          {pick(card.description)}
        </p>
      </div>

      <span className="inline-flex items-center gap-2 text-sm font-bold text-navy sm:mt-6 md:mt-7">
        <span className="hidden sm:inline"><I18nText en="View Details" ko="자세히 보기" /></span>
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
