import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  Lock,
  MessageCircle,
  MessageSquareText,
  Settings,
  ShieldCheck
} from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccPermissionRequestCard } from "@/components/EccPermissionRequestCard";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentEccAccess, getEccOfficialTeamChatUrl } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC OFFICIAL",
  description: "Official ECC member lounge for confirmed K_LINE ECC members.",
  path: "/ecc-official"
});

export default async function EccOfficialPage() {
  const access = await getCurrentEccAccess();

  if (!access.isLoggedIn) {
    return (
      <OfficialShell>
        <AccessMessage
          title={<I18nText en="Login required" ko="로그인이 필요합니다" />}
          description={
            <I18nText
              en="Please log in with Google to check your ECC official membership status."
              ko="ECC 정식회원 상태를 확인하려면 Google 계정으로 로그인해 주세요."
            />
          }
          href="/login"
          cta={<I18nText en="Go to Login" ko="로그인하러 가기" />}
        />
      </OfficialShell>
    );
  }

  if (!access.isOfficialMember) {
    return (
      <OfficialShell>
        <AccessMessage
          title={
            <I18nText
              en="Your ECC official membership has not been confirmed yet."
              ko="아직 ECC 정식회원으로 확인되지 않았습니다."
            />
          }
          description={
            <I18nText
              en="Please submit the K_LINE new member registration form and complete the membership fee payment. After an officer confirms payment, ECC OFFICIAL will open for this account."
              ko="K_LINE 신규회원 등록폼 제출과 회비 납부를 완료해 주세요. 운영진이 납부를 확인하면 이 계정에서 ECC OFFICIAL이 열립니다."
            />
          }
          href="/our-activities/ecc/register"
          cta={<I18nText en="New Member Registration" ko="신규회원 등록" />}
        />
      </OfficialShell>
    );
  }

  const teamChatUrl = getEccOfficialTeamChatUrl();

  return (
    <OfficialShell>
      <section className="grid gap-6">
        <div className="paper-panel grid gap-6 p-5 md:p-8 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
              <ShieldCheck aria-hidden className="h-4 w-4" />
              <I18nText en="Confirmed member" ko="정식회원 확인됨" />
            </div>
            <h2 className="mt-5 font-serif text-4xl font-semibold text-ink">
              <I18nText en="Welcome, official ECC member." ko="ECC 정식회원 라운지에 오신 것을 환영합니다." />
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/66">
              <I18nText
                en="Please use your registered name or KakaoTalk display name when joining the official team chat."
                ko="공식 팀채팅에 입장할 때는 등록한 이름 또는 카카오톡 표시 이름을 사용해 주세요."
              />
            </p>
            <a
              href={teamChatUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex min-h-12 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              <I18nText en="Join ECC Official Team Chat" ko="ECC 공식 팀채팅 입장" />
            </a>
          </div>
          <div className="grid gap-3">
            <img
              src="/api/ecc/official-team-qr"
              alt="ECC official team chat QR code"
              className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
            />
            <p className="text-center text-xs leading-5 text-ink/54">
              <I18nText en="Scan to join the official team chat." ko="QR을 스캔해 공식 팀채팅에 입장하세요." />
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <OfficialCard
            href="/our-activities/ecc/free-board"
            icon={MessageSquareText}
            title={<I18nText en="Board" ko="ECC 게시판" />}
            description={
              <I18nText
                en="Read and write ECC official community posts."
                ko="ECC 정식회원 커뮤니티 게시글을 읽고 작성합니다."
              />
            }
          />
          <OfficialCard
            href="/our-activities/ecc/activity"
            icon={ClipboardList}
            title={<I18nText en="Activity Application" ko="활동 신청" />}
            description={
              <I18nText
                en="Apply for ECC gatherings, events, MT, and English class."
                ko="ECC 모임, 행사, MT, English Class에 신청합니다."
              />
            }
          />
          {access.isAdmin ? (
            <OfficialCard
              href="/our-activities/ecc/members"
              icon={Settings}
              title={<I18nText en="Member Management" ko="회원 관리" />}
              description={
                <I18nText
                  en="Confirm official members and manage ECC applications."
                  ko="정식회원 승인과 ECC 신청 관리를 처리합니다."
                />
              }
            />
          ) : null}
          {access.isSuperAdmin ? (
            <OfficialCard
              href="/our-activities/ecc/fund"
              icon={Banknote}
              title={<I18nText en="ECC Fund Management" ko="ECC 자금관리" />}
              description={
                <I18nText
                  en="Manage ECC fund and donation information."
                  ko="ECC 자금과 후원 정보를 관리합니다."
                />
              }
            />
          ) : null}
          {access.isDeveloper ? (
            <OfficialCard
              href="/developer"
              icon={ShieldCheck}
              title={<I18nText en="Developer Menu" ko="개발자 메뉴" />}
              description={
                <I18nText
                  en="Open developer-only dashboards and system data."
                  ko="개발자 전용 대시보드와 시스템 데이터를 확인합니다."
                />
              }
            />
          ) : null}
        </div>

        <EccPermissionRequestCard role={access.role} />
      </section>
    </OfficialShell>
  );
}

function OfficialShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="ECC official" ko="ECC 공식" />
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">ECC OFFICIAL</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              <I18nText
                en="Official member lounge for ECC members."
                ko="ECC 정식회원을 위한 공식 멤버 라운지입니다."
              />
            </p>
          </div>
          <ClubMark id="ecc" size="xl" className="hidden border-4 border-white/70 shadow-lift md:inline-flex" />
        </div>
      </section>
      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">{children}</div>
      </section>
    </>
  );
}

function AccessMessage({
  cta,
  description,
  href,
  title
}: {
  cta: React.ReactNode;
  description: React.ReactNode;
  href: string;
  title: React.ReactNode;
}) {
  return (
    <div className="paper-panel flex items-start gap-4 p-6 md:p-8">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
        <Lock aria-hidden className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">{description}</p>
        <Link
          href={href}
          className="mt-5 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          {cta}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function OfficialCard({
  description,
  href,
  icon: Icon,
  title
}: {
  description: React.ReactNode;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="paper-panel group grid min-h-56 content-between p-5 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-6"
    >
      <div>
        <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
          <Icon aria-hidden className="h-5 w-5" />
        </div>
        <h2 className="mt-5 font-serif text-3xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-ink/64">{description}</p>
      </div>
      <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4">
        <I18nText en="Open" ko="열기" />
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
