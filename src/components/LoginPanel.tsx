"use client";

import { CheckCircle2, LogIn, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { CTAButton } from "@/components/CTAButton";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type LoginPanelProps = {
  callbackUrl?: string;
};

export function LoginPanel({ callbackUrl = "/ecc-join" }: LoginPanelProps) {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isSignedIn = Boolean(session?.user);
  const { language } = useLanguage();
  const displayName = session?.user?.name ?? session?.user?.email ?? (language === "ko" ? "K_LINE 회원" : "K_LINE member");
  const safeCallbackUrl = callbackUrl.startsWith("/") && !callbackUrl.startsWith("/login")
    ? callbackUrl
    : "/ecc-join";

  return (
    <div className="grid gap-4 sm:gap-8 lg:grid-cols-[1fr_0.9fr]">
      <section className="paper-panel p-5 sm:p-6 md:p-8">
        <p className="text-sm font-semibold uppercase text-brass">
          <I18nText en="Member Login" ko="회원 로그인" />
        </p>
        <h1 className="mt-3 break-words font-serif text-3xl font-semibold leading-tight text-ink sm:mt-4 sm:text-4xl md:text-6xl">
          <I18nText en="Google login is required first." ko="먼저 Google 로그인이 필요합니다." />
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68 sm:mt-5 sm:text-base sm:leading-8">
          <I18nText
            en="K_LINE uses Google login to connect ECC registration, member status, and official member access to one trusted account."
            ko="K_LINE은 Google 로그인을 통해 ECC 등록, 회원 상태, 정식회원 권한을 하나의 신뢰할 수 있는 계정에 연결합니다."
          />
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
          {isSignedIn ? (
            <>
              <span className="grid w-full sm:w-auto">
                <CTAButton href={safeCallbackUrl}>
                  <I18nText en="Go to dashboard" ko="대시보드로 이동" />
                </CTAButton>
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink/20 px-5 py-3 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10 sm:min-h-11 sm:w-auto sm:rounded-none"
              >
                <LogOut aria-hidden className="h-4 w-4" />
                <I18nText en="Sign out" ko="로그아웃" />
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                signIn("google", {
                  callbackUrl: safeCallbackUrl,
                  redirectTo: safeCallbackUrl
                })
              }
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:w-auto sm:rounded-none"
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

      <aside className="rounded-2xl bg-navy p-5 text-paper sm:rounded-none sm:p-6 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center border border-paper/25">
          {isSignedIn ? (
            <CheckCircle2 aria-hidden className="h-6 w-6 text-brass" />
          ) : (
            <ShieldCheck aria-hidden className="h-6 w-6 text-brass" />
          )}
        </div>
        <h2 className="mt-5 text-2xl font-semibold sm:mt-6">
          {isSignedIn ? (
            <I18nText en="Signed in" ko="로그인됨" />
          ) : (
            <I18nText en="Continue with Google" ko="Google로 계속하기" />
          )}
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-paper/74 sm:mt-5">
          {isSignedIn ? (
            <div className="flex min-w-0 items-start gap-3 border border-paper/15 p-4">
              <UserCircle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-brass" />
              <div className="min-w-0">
                <p className="break-words font-semibold text-paper">{displayName}</p>
                <p className="break-all">
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
                  en="K_LINE requires Google login before opening ECC registration, official member pages, and member management."
                  ko="K_LINE은 ECC 등록, 정식회원 페이지, 회원 관리를 열기 전에 Google 로그인을 먼저 요구합니다."
                />
              </p>
              <p>
                <I18nText
                  en="After login, your Google account is saved as a K_LINE site member and connected to your ECC registration."
                  ko="로그인 후 Google 계정은 K_LINE 회원으로 저장되고 ECC 신규회원 등록과 연결됩니다."
                />
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
