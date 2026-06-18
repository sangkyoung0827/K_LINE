"use client";

import Link from "next/link";
import { navigation } from "@/data/navigation";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { siteConfig } from "@/lib/seo";

const navigationLabels = {
  "/": { en: "Home", ko: "홈" },
  "/goods": { en: "Goods", ko: "상품" },
  "/k-culture-project": { en: "K-Culture Project", ko: "K-컬처 프로젝트" },
  "/our-activities": { en: "International Clubs", ko: "국제 학생 클럽" },
  "/contact": { en: "Contact", ko: "문의" }
} as const;

export function Footer() {
  const { pick } = useLanguage();
  const { isDeveloper, isSuperAdmin } = useSuperAdmin();
  const canSeeRestrictedTracks = isSuperAdmin || isDeveloper;
  const visibleNavigation = navigation.filter(
    (item) =>
      canSeeRestrictedTracks || (item.href !== "/goods" && item.href !== "/k-culture-project")
  );

  return (
    <footer className="bg-navy text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:px-8">
        <div>
          <Logo variant="light" size="sm" />
          <p className="mt-3 max-w-md text-sm leading-7 text-paper/70">
            {canSeeRestrictedTracks ? (
              <I18nText
                en="A campus K-culture hub connecting Korean cultural projects, goods, and international student clubs for university communities."
                ko="한국 문화 프로젝트, 상품, 국제 학생 클럽을 대학 커뮤니티 안에서 연결하는 캠퍼스 K-컬처 허브입니다."
              />
            ) : (
              <I18nText
                en="A campus community hub for international student clubs and university activities."
                ko="국제 학생 클럽과 대학 활동을 위한 캠퍼스 커뮤니티 허브입니다."
              />
            )}
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-paper">
            <I18nText en="Menu" ko="메뉴" />
          </p>
          <div className="grid gap-2">
            {visibleNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-paper/68 hover:text-paper">
                {navigationLabels[item.href as keyof typeof navigationLabels]
                  ? pick(navigationLabels[item.href as keyof typeof navigationLabels])
                  : item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-paper">
            <I18nText en="Contact" ko="문의" />
          </p>
          <div className="grid gap-2 text-sm text-paper/68">
            <span>{siteConfig.emailPlaceholder}</span>
            <a href={siteConfig.youtube} target="_blank" rel="noreferrer" className="hover:text-paper">
              YouTube @Weirdsang
            </a>
            <span>{siteConfig.instagramPlaceholder}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-paper/12 px-5 py-5 text-center text-xs text-paper/50">
        © {new Date().getFullYear()} K_LINE.{" "}
        {canSeeRestrictedTracks ? (
          <I18nText
            en="Inquiry-based commerce. No payment integration yet."
            ko="문의 기반 상품 흐름입니다. 실제 결제 연동은 아직 연결되지 않았습니다."
          />
        ) : (
          <I18nText
            en="International student club community."
            ko="국제 학생 클럽 커뮤니티입니다."
          />
        )}
      </div>
    </footer>
  );
}
