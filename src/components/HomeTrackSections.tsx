"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

type HomeCard = {
  href: string;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  badge: { en: string; ko: string };
  accent: "ecc" | "hanhwal" | "jeju" | "support";
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
      en: "A channel for Korean traditional archery culture experiences and club member exchange.",
      ko: "한국 전통 국궁(國弓) 문화 체험과 동문/회원 교류 채널입니다."
    },
    badge: { en: "Traditional", ko: "국궁 Traditional" },
    accent: "hanhwal"
  },
  {
    href: "/contact",
    title: { en: "Woohyukmon", ko: "우혁몬" },
    description: {
      en: "Ask anything about ECC, K_LINE, registration, or site guidance.",
      ko: "무엇이든 물어보세요. ECC, K_LINE, 가입과 사이트 이용을 안내합니다."
    },
    badge: { en: "AI Guide", ko: "AI Guide" },
    accent: "support"
  },
  {
    href: "/jeju",
    title: { en: "My Journey", ko: "추억록" },
    description: {
      en: "Record Jeju on a live map and continue your journey with Woohyukmon.",
      ko: "실시간 지도에 제주 여정을 기록하고 우혁몬과 다음 여정을 이어갑니다."
    },
    badge: { en: "Journey", ko: "추억록" },
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
      className="group relative flex min-h-0 flex-col rounded-xl border border-navy/10 bg-white/58 p-4 text-left shadow-[0_18px_45px_rgba(31,42,68,0.06)] transition duration-200 hover:-translate-y-1 hover:border-brass/70 hover:bg-white/78 hover:shadow-[0_22px_55px_rgba(31,42,68,0.10)] sm:p-5 md:min-h-[292px] md:rounded-2xl md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        {card.accent === "support" ? (
          <span className="flex h-11 w-16 items-center justify-center rounded-lg bg-white shadow-[0_14px_28px_rgba(31,42,68,0.14)] sm:h-14 sm:w-20 sm:rounded-xl">
            <WoohyukmonGlassesIcon className="h-8 w-12 sm:h-10 sm:w-16" />
          </span>
        ) : card.accent === "jeju" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#dcefe8] text-[#0d5962] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16">
            <BookOpen aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
        ) : (
          <ClubMark
            id={card.accent === "ecc" ? "ecc" : "hanhwal"}
            size="md"
            className="!h-11 !w-11 border-4 border-white bg-white shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:!h-16 sm:!w-16"
          />
        )}

        <span className="rounded-full bg-hanji/80 px-3 py-1 text-xs font-bold text-navy/80">
          {pick(card.badge)}
        </span>
      </div>

      <div className="mt-4 flex-1 sm:mt-6 md:mt-8">
        <h2 className="font-serif text-2xl font-semibold tracking-[-0.02em] text-navy sm:text-3xl md:text-4xl">
          {pick(card.title)}
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-muted sm:mt-4 sm:leading-7 md:mt-6 md:min-h-[4.5rem]">
          {pick(card.description)}
        </p>
      </div>

      <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-navy sm:mt-6 md:mt-7">
        <I18nText en="View Details" ko="자세히 보기" />
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
