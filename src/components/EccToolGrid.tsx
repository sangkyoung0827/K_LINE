"use client";

import Link from "next/link";
import { ArrowRight, Banknote, ClipboardList, MessageSquareText } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText } from "@/components/LanguageProvider";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const publicEccTools = [
  {
    eyebrow: "Free board",
    title: "ECC Board",
    titleKo: "ECC 게시판",
    description:
      "Share ECC activity records, photos, questions, notices, and open student community posts in chronological cards.",
    descriptionKo:
      "ECC 활동 기록, 사진, 질문, 공지, 자유로운 학생 커뮤니티 글을 시간순 카드 형태로 공유합니다.",
    href: "/our-activities/ecc/free-board",
    cta: "Open ECC Board",
    ctaKo: "ECC 게시판 열기",
    icon: MessageSquareText
  },
  {
    eyebrow: "Activity",
    title: "ECC Activity",
    titleKo: "ECC 활동",
    description:
      "Choose an ECC activity and submit the application form. Applicant management appears only for the super admin.",
    descriptionKo:
      "ECC 활동을 선택하고 신청서를 제출합니다. 신청자 관리는 슈퍼관리자에게만 표시됩니다.",
    href: "/our-activities/ecc/activity",
    cta: "Open ECC Activity",
    ctaKo: "ECC 활동 열기",
    icon: ClipboardList
  }
] as const;

const adminOnlyTool = {
  eyebrow: "Fund management",
  title: "ECC Fund",
  titleKo: "ECC 자금관리",
  description:
    "The super-admin can enter and manage fund and account information.",
  descriptionKo:
    "슈퍼관리자가 자금과 계좌 정보를 입력하고 관리합니다.",
  href: "/our-activities/ecc/fund",
  cta: "Open Fund Page",
  ctaKo: "자금관리 열기",
  icon: Banknote
} as const;

export function EccToolGrid() {
  const { isSuperAdmin } = useSuperAdmin();
  const tools = isSuperAdmin ? [...publicEccTools, adminOnlyTool] : publicEccTools;

  return (
    <div className={`mt-10 grid gap-5 ${isSuperAdmin ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
      {tools.map((tool) => {
        const Icon = tool.icon;

        return (
          <Link
            key={tool.href}
            href={tool.href}
            className="paper-panel group grid min-h-72 content-between p-6 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-8"
          >
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <ClubMark id="ecc" size="sm" className="border-ink/10" />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase text-brass">
                <I18nText en={tool.eyebrow} ko={tool.eyebrow} />
              </p>
              <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">
                <I18nText en={tool.title} ko={tool.titleKo} />
              </h2>
              <p className="mt-4 text-sm leading-7 text-ink/68">
                <I18nText en={tool.description} ko={tool.descriptionKo} />
              </p>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4">
              <I18nText en={tool.cta} ko={tool.ctaKo} />
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition group-hover:translate-x-1"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
