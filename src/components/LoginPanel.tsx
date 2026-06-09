"use client";

import { CheckCircle2, LogIn, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

export function LoginPanel() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isSignedIn = Boolean(session?.user);
  const { language } = useLanguage();
  const displayName = session?.user?.name ?? session?.user?.email ?? (language === "ko" ? "K_LINE 회원" : "K_LINE member");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
      <section className="paper-panel p-6 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Member Login" ko="회원 로그인" />
        </p>
        <h1 className="mt-4 font-serif text-4xl font-semibold text-ink md:text-6xl">
          <I18nText en="Join K_LINE with your Google account." ko="Google 계정으로 K_LINE에 참여하세요." />
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-ink/68">
          <I18nText
            en="Google login is the first membership channel for K_LINE. It lets visitors sign in through a trusted account while future profile, order, class booking, and project submission systems are connected later."
            ko="Google 로그인은 K_LINE의 첫 회원 채널입니다. 향후 프로필, 주문, 수업 예약, 프로젝트 제출 시스템이 연결되기 전에도 신뢰할 수 있는 계정으로 로그인할 수 있습니다."
          />
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {isSignedIn ? (
            <>
              <CTAButton href="/">
                <I18nText en="Go to dashboard" ko="대시보드로 이동" />
              </CTAButton>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/20 px-5 py-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                <I18nText en="Sign out" ko="로그아웃" />
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn aria-hidden className="h-4 w-4" />
              {isLoading
                ? language === "ko"
                  ? "세션 확인 중"
                  : "Checking session"
                : language === "ko"
                  ? "Google로 계속하기"
                  : "Continue with Google"}
            </button>
          )}
        </div>
      </section>

      <aside className="bg-navy p-6 text-paper md:p-8">
        <div className="flex h-12 w-12 items-center justify-center border border-paper/25">
          {isSignedIn ? (
            <CheckCircle2 aria-hidden className="h-6 w-6 text-brass" />
          ) : (
            <ShieldCheck aria-hidden className="h-6 w-6 text-brass" />
          )}
        </div>
        <h2 className="mt-6 text-2xl font-semibold">
          {isSignedIn ? (
            <I18nText en="Signed in" ko="로그인됨" />
          ) : (
            <I18nText en="Ready for Google OAuth" ko="Google OAuth 준비 완료" />
          )}
        </h2>
        <div className="mt-5 space-y-4 text-sm leading-7 text-paper/74">
          {isSignedIn ? (
            <div className="flex items-start gap-3 border border-paper/15 p-4">
              <UserCircle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brass" />
              <div>
                <p className="font-semibold text-paper">{displayName}</p>
                <p>
                  {session?.user?.email ?? (
                    <I18nText en="Google account connected." ko="Google 계정이 연결되었습니다." />
                  )}
                </p>
              </div>
            </div>
          ) : (
            <>
              <p>
                <I18nText
                  en="Vercel must have Google OAuth environment variables before real login works."
                  ko="실제 로그인이 작동하려면 Vercel에 Google OAuth 환경변수가 등록되어 있어야 합니다."
                />
              </p>
              <p>
                <I18nText
                  en="After login, Auth.js stores the active session. A database can be added later for full member profiles."
                  ko="로그인 후 Auth.js가 활성 세션을 저장합니다. 전체 회원 프로필용 데이터베이스는 이후 추가할 수 있습니다."
                />
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
