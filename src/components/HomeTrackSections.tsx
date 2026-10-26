"use client";

import Link from "next/link";
import { ArrowRight, CalendarRange, LibraryBig, FlaskConical } from "lucide-react";
import { WoohyukmonLauncher } from "@/components/WoohyukmonLauncher";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { SocialImpactUnionMark } from "@/components/social-impact-union/SocialImpactUnionMark";
import { socialImpactUnion } from "@/data/socialImpactUnion";
import { CoDevelopmentCard } from "@/components/co-development/CoDevelopmentCard";
import { PublishedServices } from "@/components/co-development/PublishedServices";

type HomeCard = {
  href: string;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  badge: { en: string; ko: string };
  accent: "ecc" | "hanhwal" | "woohyukmon" | "siu" | "research" | "studio" | "collaboration";
};

const homeCards: HomeCard[] = [
  {
    href: "/co-development",
    title: { en: "Developer Studio", ko: "Developer Studio" },
    description: { en: "Develop projects and submit them for review.", ko: "프로젝트를 개발하고 검토를 요청합니다." },
    badge: { en: "Development", ko: "개발" },
    accent: "collaboration"
  },
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
    href: "/event-studio",
    title: { en: "Event Studio", ko: "Event Studio" },
    description: {
      en: "Plan your event and prepare its announcement and application form.",
      ko: "내 행사를 기획하고 공지문과 신청폼을 준비합니다."
    },
    badge: { en: "Create an event", ko: "행사 만들기" },
    accent: "studio"
  },
  {
    href: "/open-k-culture-research",
    title: { en: "Open K-Culture Research", ko: "Open K-Culture Research" },
    description: {
      en: "Exploring Korean Culture, Tradition & Experience",
      ko: "한국문화의 전통, 철학, 생활문화와 실제 체험을 연구하고 기록하는 공개 아카이브"
    },
    badge: { en: "Research Archive", ko: "공개 연구" },
    accent: "research"
  }
];

export function HomeTrackSections({ showEventStudio = false, showCoDevelopment = false }: { showEventStudio?: boolean; showCoDevelopment?: boolean }) {
  return (
    <section className="bg-paper px-4 pb-10 sm:px-5 sm:pb-14 md:px-8 md:pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3 md:gap-7">
          {homeCards.filter(card => card.accent !== "studio" || showEventStudio).map((card) => (
            card.accent === "collaboration" ? <CoDevelopmentCard key={card.href} personalize={showCoDevelopment} /> : <HomePortalCard key={card.href} card={card} />
          ))}
          <PublishedServices />
        </div>
      </div>
    </section>
  );
}

function HomePortalCard({ card }: { card: HomeCard }) {
  const { pick } = useLanguage();
  const className = "group relative grid min-h-24 grid-cols-[44px_minmax(0,1fr)_20px] items-center gap-3 rounded-lg border border-navy/10 bg-white/58 p-4 text-left transition duration-200 hover:border-brass/70 hover:bg-white/78 sm:flex sm:flex-col sm:items-stretch sm:gap-0 sm:rounded-xl sm:p-5 sm:shadow-[0_18px_45px_rgba(31,42,68,0.06)] md:min-h-[292px] md:rounded-2xl md:p-8";
  const content = <>
      <div className="flex items-start justify-between gap-4">
        {card.accent === "woohyukmon" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#dcefe8] text-[#0d5962] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16">
            <WoohyukmonGlassesIcon alt="" className="h-6 w-8 sm:h-8 sm:w-12" />
          </span>
        ) : card.accent === "studio" || card.accent === "collaboration" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#dfeaf3] text-[#184b54] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16">
            {card.accent === "collaboration" ? <FlaskConical aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" /> : <CalendarRange aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" />}
          </span>
        ) : card.accent === "research" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#e9e2d1] text-[#184b54] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16">
            <LibraryBig aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" />
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
          {card.accent === "ecc" ? <I18nText en="Membership & activities" ko="회원 등록 · 활동 신청" /> : card.accent === "hanhwal" ? <I18nText en="Traditional archery club" ko="전통 국궁 동아리" /> : card.accent === "siu" ? <I18nText en="People, ideas & local impact" ko="사람 · 아이디어 · 지역의 변화" /> : card.accent === "research" ? <I18nText en="Culture, tradition & experience" ko="문화 · 전통 · 체험 연구" /> : card.accent === "studio" ? <I18nText en="Event plans, notices & forms" ko="행사 기획 · 공지 · 신청폼" /> : card.accent === "collaboration" ? <I18nText en="Private prototypes & shared tests" ko="시험 기능 · 공동 검토" /> : "K_LINE"}
        </p>
        <p className="mt-2 hidden text-sm font-medium leading-6 text-muted sm:mt-4 sm:block sm:leading-7 md:mt-6 md:min-h-[4.5rem]">
          {pick(card.description)}
        </p>
      </div>

      <span className="inline-flex items-center gap-2 text-sm font-bold text-navy sm:mt-6 md:mt-7">
        <span className="hidden sm:inline">{card.accent === "woohyukmon" ? <I18nText en="Open Woohyukmon" ko="우혁몬 열기" /> : <I18nText en="View Details" ko="자세히 보기" />}</span>
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </>;
  return card.accent === "woohyukmon"
    ? <WoohyukmonLauncher data-home-woohyukmon className={className}>{content}</WoohyukmonLauncher>
    : <Link href={card.href} className={className}>{content}</Link>;
}
