"use client";

import { usePathname } from "next/navigation";
import { I18nText } from "@/components/LanguageProvider";

export function Footer() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <footer className="bg-paper px-5 pb-10 md:px-8">
      <div className="mx-auto max-w-7xl border-t border-navy/10 pt-9 text-center text-sm font-medium text-navy/36">
        © K_LINE Campus K-Culture Hub. All rights reserved.
        <span className="sr-only">
          <I18nText en="International student club community." ko="국제 학생 클럽 커뮤니티입니다." />
        </span>
      </div>
    </footer>
  );
}
