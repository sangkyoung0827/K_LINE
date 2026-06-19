"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Code2, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { activityBoards } from "@/data/activityBoards";
import { navigation } from "@/data/navigation";
import { AuthStatus } from "@/components/AuthStatus";
import { ClubMark } from "@/components/ClubMark";
import { useCart } from "@/components/CartProvider";
import { LanguageSwitcher, useLanguage } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { useEccAccess } from "@/hooks/useEccAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const navigationLabels = {
  "/": { en: "Home", ko: "홈" },
  "/goods": { en: "Goods", ko: "상품" },
  "/k-culture-project": { en: "K-Culture Project", ko: "K-컬처 프로젝트" },
  "/our-activities": { en: "International Clubs", ko: "국제 학생 클럽" },
  "/contact": { en: "Contact", ko: "문의" }
} as const;

const boardLabels = {
  ecc: { en: "ECC", ko: "ECC" },
  hanhwal: { en: "Hanhwal", ko: "한활" }
} as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { totalQuantity } = useCart();
  const { language, pick } = useLanguage();
  const { isDeveloper, isSuperAdmin } = useSuperAdmin();
  const eccAccess = useEccAccess();
  const canSeeRestrictedTracks = isSuperAdmin || isDeveloper;
  const visibleNavigation = navigation.filter(
    (item) =>
      canSeeRestrictedTracks || (item.href !== "/goods" && item.href !== "/k-culture-project")
  );

  return (
    <header className="sticky top-0 z-50 border-b border-navy/10 bg-paper/94 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="K_LINE home">
          <Logo size="sm" />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {visibleNavigation.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const hasBoards = item.href === "/our-activities";

            if (hasBoards) {
              return (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium transition ${
                      active ? "text-ink" : "text-ink/62 hover:text-ink"
                    }`}
                  >
                    {navigationLabels[item.href as keyof typeof navigationLabels]
                      ? pick(navigationLabels[item.href as keyof typeof navigationLabels])
                      : item.label}
                    <ChevronDown
                      aria-hidden
                      className="h-3.5 w-3.5 transition group-hover:rotate-180"
                    />
                  </Link>
                  <div className="absolute left-0 top-full hidden min-w-52 border border-navy/10 bg-paper shadow-soft group-hover:grid group-focus-within:grid">
                    {activityBoards.map((board) => (
                      <Link
                        key={board.id}
                        href={`/our-activities/${board.slug}`}
                        className="inline-flex items-center gap-3 border-b border-navy/8 px-4 py-3 text-sm font-semibold text-ink/72 transition last:border-b-0 hover:bg-brass/15 hover:text-ink"
                      >
                        <ClubMark id={board.id} size="xs" className="border-ink/10" />
                        {boardLabels[board.id] ? pick(boardLabels[board.id]) : board.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm font-medium transition ${
                  active ? "text-ink" : "text-ink/62 hover:text-ink"
                }`}
              >
                {navigationLabels[item.href as keyof typeof navigationLabels]
                  ? pick(navigationLabels[item.href as keyof typeof navigationLabels])
                  : item.label}
              </Link>
            );
          })}
          {isDeveloper ? (
            <Link
              href="/developer"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition ${
                pathname.startsWith("/developer") ? "text-ink" : "text-brass hover:text-ink"
              }`}
            >
              <Code2 aria-hidden className="h-4 w-4" />
              {language === "ko" ? "개발자 전용" : "Developer"}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AuthStatus />
          {canSeeRestrictedTracks ? (
            <Link
              href="/cart"
              aria-label={language === "ko" ? "장바구니 열기" : "Open cart"}
              className="relative inline-flex h-10 w-10 items-center justify-center border border-navy/12 text-ink transition hover:border-brass hover:bg-brass/15"
            >
              <ShoppingBag aria-hidden className="h-4 w-4" />
              {totalQuantity > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-brass px-1 text-xs font-semibold text-ink">
                  {totalQuantity}
                </span>
              ) : null}
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={language === "ko" ? "메뉴 열기" : "Open navigation menu"}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center border border-navy/12 text-ink transition hover:border-brass hover:bg-brass/15 lg:hidden"
          >
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-navy/10 bg-paper lg:hidden">
          <div className="mx-auto grid max-w-7xl px-5 py-4">
            <MobileMenuLink href="/" onClick={() => setOpen(false)}>
              <I18nNavText en="Home" ko="홈" language={language} />
            </MobileMenuLink>
            <MobileMenuLink href="/our-activities" onClick={() => setOpen(false)}>
              <I18nNavText en="International Student Club" ko="국제 학생 클럽" language={language} />
            </MobileMenuLink>
            {eccAccess.isLoggedIn && !eccAccess.isOfficialMember ? (
              <>
                <MobileMenuLink href="/ecc-join" onClick={() => setOpen(false)}>
                  <I18nNavText en="New Member Registration" ko="신규회원 등록" language={language} />
                </MobileMenuLink>
                <MobileMenuLink href="/ecc-join" onClick={() => setOpen(false)}>
                  <I18nNavText en="My Status" ko="내 상태 확인" language={language} />
                </MobileMenuLink>
              </>
            ) : null}
            {eccAccess.isOfficialMember ? (
              <>
                <MobileMenuLink href="/ecc-official" onClick={() => setOpen(false)}>
                  ECC OFFICIAL
                </MobileMenuLink>
                <MobileMenuLink href="/ecc-official" onClick={() => setOpen(false)}>
                  <I18nNavText en="My Status" ko="내 상태 확인" language={language} />
                </MobileMenuLink>
              </>
            ) : null}
            {eccAccess.isAdmin ? (
              <MobileMenuLink href="/our-activities/ecc/members" onClick={() => setOpen(false)}>
                <I18nNavText en="Member Management" ko="회원 관리" language={language} />
              </MobileMenuLink>
            ) : null}
            {!eccAccess.isLoggedIn && !eccAccess.loading ? (
              <MobileMenuLink href="/login" onClick={() => setOpen(false)}>
                <I18nNavText en="Login / Profile" ko="로그인 / 프로필" language={language} />
              </MobileMenuLink>
            ) : null}
            {isDeveloper ? (
              <Link
                href="/developer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 border-b border-navy/8 py-3 text-sm font-semibold text-brass"
              >
                <Code2 aria-hidden className="h-4 w-4" />
                {language === "ko" ? "개발자 전용" : "Developer"}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MobileMenuLink({
  children,
  href,
  onClick
}: {
  children: React.ReactNode;
  href: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="border-b border-navy/8 py-3 text-sm font-semibold text-ink/76 last:border-b-0"
    >
      {children}
    </Link>
  );
}

function I18nNavText({
  en,
  ko,
  language
}: {
  en: string;
  ko: string;
  language: "en" | "ko";
}) {
  return <>{language === "ko" ? ko : en}</>;
}
