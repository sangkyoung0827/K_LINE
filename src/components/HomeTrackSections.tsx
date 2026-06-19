"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { BookOpenText, Boxes, ClipboardList, GalleryVerticalEnd, LogIn, ShieldCheck, UserCheck } from "lucide-react";
import { ActivityPreviewCard } from "@/components/ActivityPreviewCard";
import { DashboardCard } from "@/components/DashboardCard";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { activityBoards } from "@/data/activityBoards";
import { useEccAccess } from "@/hooks/useEccAccess";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const developerGoodsDashboardSection = {
  title: "Goods",
  eyebrow: <I18nText en="Goods" ko="상품" />,
  description: (
    <I18nText
      en="Developer-only product draft area while goods are being prepared."
      ko="상품 준비가 완료되기 전까지 개발자만 확인하는 상품 초안 영역입니다."
    />
  ),
  href: "/goods",
  action: <I18nText en="Open Goods Drafts" ko="상품 초안 열기" />,
  icon: Boxes
};

const kCultureDashboardSection = {
  title: "K-Culture Project",
  eyebrow: <I18nText en="K-Culture Project" ko="K-컬처 프로젝트" />,
  description: (
    <I18nText en="Student-made international projects." ko="학생들이 만들어나가는 국제적 프로젝트들" />
  ),
  href: "/k-culture-project",
  action: <I18nText en="View Projects" ko="프로젝트 보기" />,
  icon: GalleryVerticalEnd
};

const clubsDashboardSection = {
  title: "International Clubs",
  eyebrow: <I18nText en="International Clubs" ko="국제 학생 클럽" />,
  description: (
    <I18nText
      en="Read and share club records, news-style posts, reviews, field notes, and community stories."
      ko="클럽 기록, 소식, 후기, 현장 노트, 커뮤니티 이야기를 읽고 공유합니다."
    />
  ),
  href: "/our-activities",
  action: <I18nText en="View Clubs" ko="클럽 보기" />,
  icon: BookOpenText
};

export function HomeTrackSections() {
  const { isDeveloper, isSuperAdmin } = useSuperAdmin();
  const canSeeProjects = isSuperAdmin || isDeveloper;
  const dashboardSections = [
    clubsDashboardSection,
    ...(isDeveloper ? [developerGoodsDashboardSection] : []),
    ...(canSeeProjects ? [kCultureDashboardSection] : [])
  ];
  const hasMultipleTracks = dashboardSections.length > 1;

  return (
    <>
      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <MobileEccEntryCard />
          <SectionHeader
            eyebrow={
              hasMultipleTracks ? (
                <I18nText en="Role-based tracks" ko="권한별 주요 흐름" />
              ) : (
                <I18nText en="Main track" ko="주요 흐름" />
              )
            }
            title={<I18nText en="Dashboard" ko="Dashboard" />}
            description={
              hasMultipleTracks ? (
                <I18nText
                  en="K_LINE keeps the experience focused on student clubs and role-based project tools."
                  ko="K_LINE은 학생 클럽과 권한별 프로젝트 도구를 중심으로 운영됩니다."
                />
              ) : (
                <I18nText
                  en="K_LINE keeps the member experience focused on international student clubs."
                  ko="일반 회원 화면에서는 국제 학생 클럽 중심으로 이용할 수 있습니다."
                />
              )
            }
            align="center"
          />
          <div
            className={`mt-12 grid gap-6 ${
              hasMultipleTracks ? "lg:grid-cols-3" : "mx-auto max-w-xl"
            }`}
          >
            {dashboardSections.map((section) => (
              <DashboardCard key={section.title} {...section} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/55 py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="International clubs" ko="국제 학생 클럽" />}
            title={<I18nText en="Meet the student clubs" ko="학생 클럽 전체를 만나보세요" />}
            description={
              <I18nText
                en="ECC and Hanhwal give students a place to share club records, photos, questions, and campus stories."
                ko="ECC와 한활은 학생들이 활동 기록, 사진, 질문, 캠퍼스 이야기를 나누는 공간입니다."
              />
            }
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {activityBoards.map((board, index) => (
              <ActivityPreviewCard
                key={board.id}
                board={board}
                accent={index === 0 ? "gold" : "green"}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function MobileEccEntryCard() {
  const access = useEccAccess();

  return (
    <div className="mb-8 md:hidden">
      <section className="paper-panel p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-navy text-paper">
            <UserCheck aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-brass">ECC</p>
            <h2 className="mt-1 font-serif text-3xl font-semibold text-ink">
              <I18nText en="Join ECC" ko="ECC 가입하기" />
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              <I18nText
                en="Log in to K_LINE and complete the new member registration form."
                ko="K_LINE에 로그인하고 신규회원 등록폼을 작성하세요."
              />
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {!access.isLoggedIn && !access.loading ? (
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/ecc-join" })}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <LogIn aria-hidden className="h-4 w-4" />
              <I18nText en="Log in with Google" ko="Google로 로그인" />
            </button>
          ) : null}

          {access.isOfficialMember ? (
            <>
              <Link
                href="/ecc-official"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <ShieldCheck aria-hidden className="h-4 w-4" />
                ECC OFFICIAL
              </Link>
              <Link
                href="/ecc-official"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-navy/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <I18nText en="Join ECC Official Team Chat" ko="ECC 공식 팀채팅 입장" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/ecc-join"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-brass px-4 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper"
              >
                <ClipboardList aria-hidden className="h-4 w-4" />
                <I18nText en="New Member Registration" ko="신규회원 등록" />
              </Link>
              <Link
                href="/ecc-join"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-navy/18 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
              >
                <I18nText en="Check My Status" ko="내 상태 확인" />
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
