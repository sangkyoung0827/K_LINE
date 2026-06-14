"use client";

import Link from "next/link";
import { ArrowRight, UserPlus, UsersRound } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { I18nText } from "@/components/LanguageProvider";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const membershipCards = [
  {
    eyebrow: "New member",
    eyebrowKo: "신규 회원",
    title: "New Member Registration",
    titleKo: "신규 회원 등록",
    description:
      "New ECC members can leave their name, KakaoTalk ID, and contact information here.",
    descriptionKo:
      "신규 ECC 회원은 이곳에서 이름, 카카오톡 ID, 연락처 정보를 등록할 수 있습니다.",
    href: "/our-activities/ecc/register",
    cta: "Register as Member",
    ctaKo: "신규 회원 등록하기",
    icon: UserPlus,
    public: true
  },
  {
    eyebrow: "Member management",
    eyebrowKo: "회원 관리",
    title: "Member Management",
    titleKo: "회원 관리",
    description:
      "Super admins can confirm fee payment, prepare team chat invitations, and manage invite status.",
    descriptionKo:
      "슈퍼관리자는 회비 납부를 확인하고 팀채팅 초대 링크, QR, 초대 상태를 관리할 수 있습니다.",
    href: "/our-activities/ecc/members",
    cta: "Open Member Management",
    ctaKo: "회원 관리 열기",
    icon: UsersRound,
    public: false
  }
] as const;

export function EccMembershipCards() {
  const { isSuperAdmin } = useSuperAdmin();
  const visibleCards = membershipCards.filter((card) => card.public || isSuperAdmin);

  return (
    <div className="mt-10 grid gap-5">
      {visibleCards.map((card) => {
        const Icon = card.icon;

        return (
          <Link
            key={card.href}
            href={card.href}
            className="paper-panel group grid min-h-44 content-between p-6 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-8"
          >
            <div className="flex gap-5">
              <div className="grid shrink-0 gap-3">
                <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper transition group-hover:bg-brass group-hover:text-ink">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <ClubMark id="ecc" size="sm" className="border-ink/10" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-brass">
                  <I18nText en={card.eyebrow} ko={card.eyebrowKo} />
                </p>
                <h2 className="mt-3 font-serif text-3xl font-semibold text-ink md:text-4xl">
                  <I18nText en={card.title} ko={card.titleKo} />
                </h2>
                <p className="mt-4 text-sm leading-7 text-ink/68">
                  <I18nText en={card.description} ko={card.descriptionKo} />
                </p>
              </div>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4">
              <I18nText en={card.cta} ko={card.ctaKo} />
              <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
