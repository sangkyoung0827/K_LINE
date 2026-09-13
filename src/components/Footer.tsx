"use client";

import { usePathname } from "next/navigation";
import { I18nText } from "@/components/LanguageProvider";

export function Footer() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <footer className="bg-paper px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-5 md:px-8">
      {pathname === "/" ? (
        <details className="mx-auto mb-4 max-w-7xl text-xs leading-6 text-muted sm:hidden">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold"><I18nText en="About K_LINE" ko="K_LINE 소개" /></summary>
          <p><I18nText en="Korea Campus K-Culture & International Student Hub" ko="한국 캠퍼스 K-컬처 및 국제학생 허브" /></p>
          <p className="mt-1"><I18nText en="K_LINE is a Korea-based campus platform connecting international students with Korean university communities, K-culture experiences, student clubs, local activities and cultural projects." ko="K_LINE은 외국인 유학생과 한국 대학생을 연결하고 대학 생활, K-컬처, 지역 문화, 동아리 및 다양한 한국 체험을 제공하는 캠퍼스 기반 국제교류 플랫폼입니다." /></p>
        </details>
      ) : null}
      <div className="mx-auto max-w-7xl border-t border-navy/10 pt-5 text-center text-xs font-medium leading-6 text-muted sm:pt-9 sm:text-sm sm:text-navy/36">
        © K_LINE Campus K-Culture Hub. All rights reserved.
        <span className="sr-only">
          <I18nText en="International student club community." ko="국제 학생 클럽 커뮤니티입니다." />
        </span>
      </div>
    </footer>
  );
}
