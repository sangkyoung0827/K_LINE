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
      <div className="mx-auto max-w-7xl border-t border-navy/10 pt-7 text-center text-xs font-medium leading-6 text-navy/36 sm:pt-9 sm:text-sm">
        © K_LINE Campus K-Culture Hub. All rights reserved.
        <span className="sr-only">
          <I18nText en="International student club community." ko="국제 학생 클럽 커뮤니티입니다." />
        </span>
      </div>
    </footer>
  );
}
