"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  UserCog
} from "lucide-react";
import { I18nText } from "@/components/LanguageProvider";
import type { EccRole } from "@/lib/eccAccess";

const officialEccTools = [
  {
    eyebrow: "Official lounge",
    title: "ECC OFFICIAL",
    titleKo: "ECC OFFICIAL",
    description:
      "Official ECC members can enter the protected lounge, team chat, board, and activity flow.",
    descriptionKo:
      "ECC 정식회원은 보호된 라운지, 공식 팀채팅, 게시판, 활동 신청 흐름을 이용할 수 있습니다.",
    href: "/ecc-official",
    cta: "Open ECC OFFICIAL",
    ctaKo: "ECC OFFICIAL 열기",
    icon: MessageCircle,
    minimumRole: "official_member"
  },
  {
    eyebrow: "Free board",
    title: "ECC Board",
    titleKo: "ECC 게시판",
    description:
      "Share ECC activity records, photos, questions, notices, and open student community posts in chronological cards.",
    descriptionKo:
      "ECC 활동 기록, 사진, 질문, 공지, 자유로운 학생 커뮤니티 글을 시간순 카드 형태로 공유합니다.",
    href: "/our-activities/ecc/free-board",
    cta: "Open ECC Board",
    ctaKo: "ECC 게시판 열기",
    icon: MessageSquareText,
    minimumRole: "official_member"
  },
  {
    eyebrow: "Activity",
    title: "ECC Activity",
    titleKo: "ECC 활동",
    description:
      "Choose an ECC activity and submit the application form. Applicant management appears only for admins.",
    descriptionKo:
      "ECC 활동을 선택하고 신청서를 제출합니다. 신청자 관리는 관리자 이상에게만 표시됩니다.",
    href: "/our-activities/ecc/activity",
    cta: "Open ECC Activity",
    ctaKo: "ECC 활동 열기",
    icon: ClipboardList,
    minimumRole: "official_member"
  },
  {
    eyebrow: "Member management",
    title: "Member Management",
    titleKo: "회원 관리",
    description:
      "Admins can approve official members and manage ECC applications.",
    descriptionKo:
      "관리자는 정식회원을 승인하고 ECC 신청 내역을 관리할 수 있습니다.",
    href: "/our-activities/ecc/members",
    cta: "Open Management",
    ctaKo: "관리 열기",
    icon: UserCog,
    minimumRole: "admin"
  }
] as const;

const superAdminOnlyTool = {
  eyebrow: "Fund management",
  title: "ECC Fund",
  titleKo: "ECC 자금관리",
  description:
    "The super-admin can enter and manage fund and account information.",
  descriptionKo:
    "슈퍼관리자가 자금과 계좌 정보를 입력하고 관리합니다.",
  href: "/our-activities/ecc/fund",
  cta: "Open Fund Page",
  ctaKo: "자금관리 열기",
  icon: Banknote,
  minimumRole: "super_admin"
} as const;

const developerOnlyTool = {
  eyebrow: "Developer",
  title: "Developer Menu",
  titleKo: "개발자 메뉴",
  description:
    "Developer-only system dashboard, member data, and role acquisition account information.",
  descriptionKo:
    "개발자 전용 시스템 대시보드, 회원 데이터, 권한 계정 정보를 확인합니다.",
  href: "/developer",
  cta: "Open Developer Page",
  ctaKo: "개발자 페이지 열기",
  icon: ShieldCheck,
  minimumRole: "developer"
} as const;

const roleRank: Record<EccRole, number> = {
  admin: 3,
  developer: 5,
  official_member: 2,
  super_admin: 4,
  user: 1
};

export function EccToolGrid({ role }: { role: EccRole }) {
  const tools = [...officialEccTools, superAdminOnlyTool, developerOnlyTool].filter(
    (tool) => roleRank[role] >= roleRank[tool.minimumRole]
  );

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => {
        const Icon = tool.icon;

        return (
          <Link
            key={tool.href}
            href={tool.href}
            className="paper-panel group grid min-h-72 content-between p-6 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-8"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
                <Icon aria-hidden className="h-5 w-5" />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase text-brass">
                <I18nText en={tool.eyebrow} ko={tool.eyebrow} />
              </p>
              <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">
                <I18nText en={tool.title} ko={tool.titleKo} />
              </h2>
              <p className="mt-4 text-sm leading-7 text-ink/68">
                <I18nText en={tool.description} ko={tool.descriptionKo} />
              </p>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4">
              <I18nText en={tool.cta} ko={tool.ctaKo} />
              <ArrowRight
                aria-hidden
                className="h-4 w-4 transition group-hover:translate-x-1"
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
