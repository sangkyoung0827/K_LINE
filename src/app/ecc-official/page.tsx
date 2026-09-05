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
import { EccMemberRegistrationForm } from "@/components/EccMemberRegistrationForm";
import { EccPermissionRequestCard } from "@/components/EccPermissionRequestCard";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getEccOperationalSettings } from "@/lib/eccOperations";
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
          href="/ecc-join"
          cta={<I18nText en="New Member Registration" ko="신규회원 등록" />}
        />
      </OfficialShell>
    );
  }

  const operations = await getEccOperationalSettings();
  const teamChatUrl = operations.officialTeamChatUrl;

  return (
    <OfficialShell>
      <section className="grid gap-6">
        <div className="paper-panel mx-auto grid w-full max-w-5xl justify-items-center p-4 text-center sm:p-6 md:p-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
              <ShieldCheck aria-hidden className="h-4 w-4" />
              <I18nText en="Confirmed member" ko="정식회원 확인됨" />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-semibold text-ink sm:mt-5 sm:text-3xl md:text-4xl">
              <I18nText en="Join the ECC team chat" ko="ECC 팀채팅에 입장하세요" />
            </h2>
            <p className="mt-4 text-sm leading-7 text-ink/66">
              <I18nText
                en="Please use your registered name or KakaoTalk display name when joining the official team chat."
                ko="공식 팀채팅에 입장할 때는 등록한 이름 또는 카카오톡 표시 이름을 사용해 주세요."
              />
            </p>
          </div>
          <div className="mt-5 grid w-full max-w-52 gap-3 sm:mt-6 sm:max-w-60">
            <img
              src="/api/ecc/official-team-qr"
              alt="ECC official team chat QR code"
              className="aspect-square w-full border border-ink/10 bg-white object-contain p-3"
            />
            <a
              href={teamChatUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <MessageCircle aria-hidden className="h-4 w-4" />
              <I18nText en="Join ECC Official Team Chat" ko="ECC 공식 팀채팅 입장" />
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <EccMemberRegistrationForm />
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <p className="mb-3 text-sm font-semibold text-ink/58">
            <I18nText en="Next" ko="다음 할 일" />
          </p>
          <div className="overflow-hidden border border-ink/10 bg-white/50">
            <OfficialRow
              href="/our-activities/ecc/free-board"
              icon={MessageSquareText}
              title={<I18nText en="Board" ko="ECC 게시판" />}
            />
            <OfficialRow
              href="/our-activities/ecc/activity"
              icon={ClipboardList}
              title={<I18nText en="Activity Application" ko="활동 신청" />}
            />
            {access.isAdmin ? (
              <OfficialRow
                href="/our-activities/ecc/members"
                icon={Settings}
                title={<I18nText en="Member Management" ko="회원 관리" />}
              />
            ) : null}
            {access.isAdmin ? (
              <OfficialRow
                href="/our-activities/ecc/fund"
                icon={Banknote}
                title={<I18nText en="ECC Fund Management" ko="ECC 자금관리" />}
              />
            ) : null}
            {access.isAdmin ? (
              <OfficialRow
                href="/our-activities/ecc/operations"
                icon={Settings}
                title={<I18nText en="Semester Operations" ko="학기 운영 설정" />}
              />
            ) : null}
            {access.isDeveloper ? (
              <OfficialRow
                href="/developer"
                icon={ShieldCheck}
                title={<I18nText en="Developer Menu" ko="개발자 메뉴" />}
              />
            ) : null}
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl pt-2 text-center">
          <EccPermissionRequestCard role={access.role} />
        </div>
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
      <section className="bg-paper py-10 sm:py-14 md:py-20">
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
    <div className="paper-panel flex flex-col items-start gap-4 p-5 sm:flex-row sm:p-6 md:p-8">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
        <Lock aria-hidden className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
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

function OfficialRow({
  href,
  icon: Icon,
  title
}: {
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-b-0 transition hover:bg-white/70 sm:min-h-20 sm:gap-4 sm:px-5 sm:py-4 md:px-6"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
        <Icon aria-hidden className="h-5 w-5" />
      </div>
      <span className="text-base font-semibold text-ink sm:text-lg md:text-xl">{title}</span>
      <span className="ml-auto text-ink/45 transition group-hover:translate-x-1 group-hover:text-ink">
        <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
