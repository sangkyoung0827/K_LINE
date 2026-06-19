"use client";

import { CTAButton } from "@/components/CTAButton";
import { I18nText } from "@/components/LanguageProvider";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export function HeroActions() {
  const { isDeveloper, isSuperAdmin } = useSuperAdmin();
  const canSeeProjects = isSuperAdmin || isDeveloper;

  return (
    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
      {canSeeProjects ? (
        <CTAButton href="/k-culture-project" variant="light">
          <I18nText en="Explore Projects" ko="프로젝트 보기" />
        </CTAButton>
      ) : null}
      <CTAButton href="/our-activities" variant="lightOutline">
        <I18nText en="View Clubs" ko="클럽 보기" />
      </CTAButton>
      {isDeveloper ? (
        <CTAButton href="/goods" variant="gold">
          <I18nText en="Shop Goods" ko="상품 보기" />
        </CTAButton>
      ) : null}
    </div>
  );
}
