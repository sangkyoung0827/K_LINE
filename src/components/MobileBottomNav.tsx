"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { useLanguage } from "@/components/LanguageProvider";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { language } = useLanguage();
  if (pathname === "/login") return null;

  const items = [
    { href: "/", label: language === "ko" ? "홈" : "Home", active: pathname === "/", icon: <Home aria-hidden className="h-5 w-5" /> },
    { href: "/our-activities/ecc", label: "ECC", active: pathname.startsWith("/our-activities/ecc") || pathname.startsWith("/ecc-"), icon: <ClubMark id="ecc" size="xs" className="!h-6 !w-6" /> },
    { href: "/our-activities/hanhwal", label: language === "ko" ? "한활" : "Hanhwal", active: pathname.startsWith("/our-activities/hanhwal") || pathname.startsWith("/hanhwal-"), icon: <ClubMark id="hanhwal" size="xs" className="!h-6 !w-6" /> },
    { href: "/jeju", label: language === "ko" ? "추억록" : "My Journey", active: pathname.startsWith("/jeju"), icon: <BookOpen aria-hidden className="h-5 w-5" /> }
  ];

  return (
    <nav aria-label={language === "ko" ? "주요 메뉴" : "Main navigation"} className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-navy/10 bg-paper/95 backdrop-blur-xl md:hidden">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-4 ${item.active ? "text-navy" : "text-muted"}`}>
          <span className={`flex h-8 w-12 items-center justify-center rounded-lg ${item.active ? "bg-navy/10" : ""}`}>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
