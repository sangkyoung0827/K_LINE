"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MyClubsSheet } from "@/components/MyClubsSheet";
import { useLanguage } from "@/components/LanguageProvider";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { data: session, status } = useSession();
  const ownerEmail = session?.user?.email ?? "";
  const [clubsOpen, setClubsOpen] = useState(false);
  const clubsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeClubs = useCallback(() => setClubsOpen(false), []);
  useEffect(() => { closeClubs(); }, [pathname, ownerEmail, status, closeClubs]);
  useEffect(() => {
    if (wasOpen.current && !clubsOpen) clubsButton.current?.focus();
    wasOpen.current = clubsOpen;
  }, [clubsOpen]);
  if (pathname === "/login") return null;

  const clubsActive = clubsOpen || pathname === "/my-history" || pathname.startsWith("/our-activities/ecc") ||
    pathname.startsWith("/our-activities/hanhwal") || pathname.startsWith("/ecc-") ||
    pathname.startsWith("/hanhwal-");

  const items = [
    { href: "/", label: language === "ko" ? "홈" : "Home", active: pathname === "/", icon: <Home aria-hidden className="h-5 w-5" /> },
    { href: "/jeju", label: "My journey", active: pathname.startsWith("/jeju"), icon: <BookOpen aria-hidden className="h-5 w-5" /> }
  ];

  return (
    <>
    <nav aria-label={language === "ko" ? "주요 메뉴" : "Main navigation"} className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-navy/10 bg-paper/95 backdrop-blur-xl md:hidden">
      <button ref={clubsButton} type="button" onClick={() => setClubsOpen(true)} aria-haspopup="dialog" aria-controls="mobile-my-clubs" aria-expanded={clubsOpen} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-4 ${clubsActive ? "text-navy" : "text-muted"}`}>
        <span className={`flex h-8 w-12 items-center justify-center rounded-lg ${clubsActive ? "bg-navy/10" : ""}`}><UsersRound aria-hidden className="h-5 w-5" /></span>
        <span>My clubs</span>
      </button>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-4 ${item.active ? "text-navy" : "text-muted"}`}>
          <span className={`flex h-8 w-12 items-center justify-center rounded-lg ${item.active ? "bg-navy/10" : ""}`}>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
    {clubsOpen ? <MyClubsSheet key={`${ownerEmail}:${status}`} ownerEmail={ownerEmail} sessionStatus={status} returnTo={pathname} onClose={closeClubs} /> : null}
    </>
  );
}
