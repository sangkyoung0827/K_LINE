import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { I18nText } from "@/components/LanguageProvider";
import { homePortalCardClassName } from "@/components/homePortalCard";

export function GksHubCard() {
  return <Link href="/gks-hub" data-gks-hub-card className={homePortalCardClassName}>
    <div className="flex items-start justify-between gap-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#e8efe5] text-[#365946] sm:h-16 sm:w-16">
        <GraduationCap aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" />
      </span>
      <span className="hidden text-xs font-bold text-muted sm:inline"><I18nText ko="개발자 테스트" en="Developer test" /></span>
    </div>
    <div className="min-w-0 flex-1 sm:mt-6 md:mt-8">
      <h2 className="font-serif text-xl font-semibold tracking-normal text-navy sm:text-3xl md:text-4xl">GKS Hub</h2>
      <p className="mt-2 text-xs leading-5 text-muted sm:mt-4 sm:text-sm sm:leading-7 md:min-h-[4.5rem]">
        <I18nText ko="대학 선택 · 지원 서류 준비 · 자기소개서와 학업계획서" en="University selection, document checklist and application drafts" />
      </p>
    </div>
    <span className="inline-flex items-center gap-2 text-sm font-bold text-navy sm:mt-6 md:mt-7">
      <span className="hidden sm:inline"><I18nText ko="열기" en="Open" /></span><ArrowRight aria-hidden className="h-4 w-4" />
    </span>
  </Link>;
}
