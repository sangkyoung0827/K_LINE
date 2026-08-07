"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type HomeCard = {
  href: string;
  title: { en: string; ko: string };
  description: { en: string; ko: string };
  badge: { en: string; ko: string };
  accent: "ecc" | "hanhwal" | "support";
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
  }
];

export function HomeTrackSections() {
  return (
    <section className="bg-paper px-5 pb-14 md:px-8 md:pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-7 md:grid-cols-3">
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
      className="group relative flex min-h-[292px] flex-col rounded-2xl border border-navy/10 bg-white/58 p-6 text-left shadow-[0_18px_45px_rgba(31,42,68,0.06)] transition duration-200 hover:-translate-y-1 hover:border-brass/70 hover:bg-white/78 hover:shadow-[0_22px_55px_rgba(31,42,68,0.10)] md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        {card.accent === "support" ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy text-3xl shadow-[0_14px_28px_rgba(31,42,68,0.14)]">
            😎
          </span>
        ) : (
          <ClubMark
            id={card.accent === "ecc" ? "ecc" : "hanhwal"}
            size="md"
            className="border-4 border-white bg-white shadow-[0_14px_28px_rgba(31,42,68,0.12)]"
          />
        )}

        <span className="rounded-full bg-hanji/80 px-3 py-1 text-xs font-bold text-navy/80">
          {pick(card.badge)}
        </span>
      </div>

      <div className="mt-8 flex-1">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.02em] text-navy md:text-4xl">
          {pick(card.title)}
        </h2>
        <p className="mt-6 min-h-[4.5rem] text-sm font-medium leading-7 text-muted">
          {pick(card.description)}
        </p>
      </div>

      <span className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-navy">
        <I18nText en="View Details" ko="자세히 보기" />
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
