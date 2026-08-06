"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Code2, Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { activityBoards } from "@/data/activityBoards";
import { AuthStatus } from "@/components/AuthStatus";
import { ClubMark } from "@/components/ClubMark";
import { useCart } from "@/components/CartProvider";
import { LanguageSwitcher, useLanguage } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { useEccAccess } from "@/hooks/useEccAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const boardLabels = {
  ecc: { en: "ECC", ko: "ECC" },
  hanhwal: { en: "Hanhwal", ko: "한활" }
} as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { totalQuantity } = useCart();
  const { language, pick } = useLanguage();
  const { isDeveloper } = useSuperAdmin();
  const eccAccess = useEccAccess();

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-navy/8 bg-paper/96 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-[92px] max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="K_LINE home" className="shrink-0">
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-9 lg:flex">
          <DesktopNavLink href="/" active={pathname === "/"}>
            {language === "ko" ? "홈" : "Home"}
          </DesktopNavLink>

          <div className="group relative">
            <Link
              href="/our-activities"
              className={`inline-flex items-center gap-1.5 px-2 py-3 text-sm font-semibold transition ${
                pathname.startsWith("/our-activities") || pathname.startsWith("/ecc-alumni")
                  ? "text-navy"
                  : "text-ink/70 hover:text-navy"
              }`}
            >
              {language === "ko" ? "국제학생클럽" : "International Student Club"}
              <ChevronDown
                aria-hidden
                className="h-3.5 w-3.5 transition group-hover:rotate-180"
              />
            </Link>
            <div className="absolute left-1/2 top-full hidden min-w-56 -translate-x-1/2 rounded-2xl border border-navy/10 bg-white/92 p-2 shadow-[0_20px_50px_rgba(31,42,68,0.12)] backdrop-blur group-hover:grid group-focus-within:grid">
              {activityBoards.map((board) => (
                <Link
                  key={board.id}
                  href={`/our-activities/${board.slug}`}
                  className="inline-flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink/72 transition hover:bg-hanji/70 hover:text-navy"
                >
                  <ClubMark id={board.id} size="xs" className="border-ink/10" />
                  {boardLabels[board.id] ? pick(boardLabels[board.id]) : board.label}
                </Link>
              ))}
              <Link
                href="/ecc-alumni"
                className="inline-flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink/72 transition hover:bg-hanji/70 hover:text-navy"
              >
                <ClubMark id="ecc" size="xs" className="border-ink/10" />
                ECC Alumni
              </Link>
            </div>
          </div>

          <DesktopNavLink href="/contact" active={pathname.startsWith("/contact")}>
            {language === "ko" ? "문의" : "Contact"}
          </DesktopNavLink>

          {isDeveloper ? (
            <Link
              href="/developer"
              className={`inline-flex items-center gap-1.5 px-2 py-3 text-sm font-semibold transition ${
                pathname.startsWith("/developer") ? "text-navy" : "text-brass hover:text-navy"
              }`}
            >
              <Code2 aria-hidden className="h-4 w-4" />
              {language === "ko" ? "개발자" : "Developer"}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <AuthStatus />
          {isDeveloper ? (
            <Link
              href="/cart"
              aria-label={language === "ko" ? "장바구니 열기" : "Open cart"}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy/12 bg-white/45 text-ink transition hover:border-brass hover:bg-brass/15"
            >
              <ShoppingBag aria-hidden className="h-4 w-4" />
              {totalQuantity > 0 ? (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1 text-xs font-semibold text-ink">
                  {totalQuantity}
                </span>
              ) : null}
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={language === "ko" ? "메뉴 열기" : "Open navigation menu"}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-navy/12 bg-white/45 text-ink transition hover:border-brass hover:bg-brass/15 lg:hidden"
          >
            {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-navy/8 bg-paper lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1 px-5 py-4">
            <MobileMenuLink href="/" onClick={() => setOpen(false)}>
              <I18nNavText en="Home" ko="홈" language={language} />
            </MobileMenuLink>
            <MobileMenuLink href="/our-activities" onClick={() => setOpen(false)}>
              <I18nNavText en="International Student Club" ko="국제학생클럽" language={language} />
            </MobileMenuLink>
            <MobileMenuLink href="/our-activities/ecc" onClick={() => setOpen(false)}>
              ECC
            </MobileMenuLink>
            <MobileMenuLink href="/our-activities/hanhwal" onClick={() => setOpen(false)}>
              <I18nNavText en="Hanhwal" ko="한활" language={language} />
            </MobileMenuLink>
            <MobileMenuLink href="/ecc-alumni" onClick={() => setOpen(false)}>
              ECC Alumni
            </MobileMenuLink>
            <MobileMenuLink href="/contact" onClick={() => setOpen(false)}>
              <I18nNavText en="Contact" ko="문의" language={language} />
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
                className="inline-flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold text-brass transition hover:bg-white/60"
              >
                <Code2 aria-hidden className="h-4 w-4" />
                {language === "ko" ? "개발자" : "Developer"}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function DesktopNavLink({
  children,
  href,
  active
}: {
  children: React.ReactNode;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative px-2 py-3 text-sm font-semibold transition ${
        active ? "text-navy" : "text-ink/70 hover:text-navy"
      }`}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-navy" aria-hidden />
      ) : null}
    </Link>
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
      className="rounded-xl px-3 py-3 text-sm font-semibold text-ink/76 transition hover:bg-white/60 hover:text-navy"
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
