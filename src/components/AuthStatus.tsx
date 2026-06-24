"use client";

import Link from "next/link";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

export function AuthStatus() {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const isLoading = status === "loading";

  if (isLoading) {
    return (
      <div
        aria-label={language === "ko" ? "로그인 상태 확인 중" : "Checking login status"}
        className="hidden h-10 w-10 items-center justify-center border border-ink/12 text-ink/40 md:inline-flex"
      >
        <UserCircle aria-hidden className="h-4 w-4" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <>
        <button
          type="button"
          aria-label={language === "ko" ? "구글로 로그인" : "Sign in with Google"}
          onClick={() => signIn("google", { callbackUrl: "/ecc-join", redirectTo: "/ecc-join" })}
          className="hidden h-10 items-center justify-center gap-2 border border-ink/12 px-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10 md:inline-flex"
        >
          <LogIn aria-hidden className="h-4 w-4" />
          <I18nText en="Login" ko="로그인" />
        </button>
        <Link
          href="/login?callbackUrl=/ecc-join"
          aria-label={language === "ko" ? "로그인 페이지 열기" : "Open login page"}
          className="inline-flex h-10 w-10 items-center justify-center border border-ink/12 text-ink transition hover:border-brass hover:bg-brass/10 md:hidden"
        >
          <LogIn aria-hidden className="h-4 w-4" />
        </Link>
      </>
    );
  }

  const displayName = session.user.name ?? session.user.email ?? (language === "ko" ? "회원" : "Member");

  return (
    <>
      <Link
        href="/login?callbackUrl=/ecc-join"
        aria-label={language === "ko" ? `${displayName} 계정으로 로그인됨` : `Logged in as ${displayName}`}
        className="inline-flex h-10 w-10 items-center justify-center border border-ink/12 text-ink transition hover:border-brass hover:bg-brass/10 md:hidden"
      >
        <UserCircle aria-hidden className="h-4 w-4" />
      </Link>
      <div className="hidden items-center gap-2 md:flex">
        <Link
          href="/login?callbackUrl=/ecc-join"
          className="inline-flex h-10 max-w-44 items-center gap-2 border border-ink/12 px-3 text-sm text-ink transition hover:border-brass hover:bg-brass/10"
          aria-label={language === "ko" ? `${displayName} 계정으로 로그인됨` : `Logged in as ${displayName}`}
        >
          <UserCircle aria-hidden className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayName}</span>
        </Link>
        <button
          type="button"
          aria-label={language === "ko" ? "로그아웃" : "Sign out"}
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex h-10 w-10 items-center justify-center border border-ink/12 text-ink transition hover:border-brass hover:bg-brass/10"
        >
          <LogOut aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
