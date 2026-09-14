"use client";

import Link from "next/link";
import { ChevronDown, UserRound, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { ClubMark } from "@/components/ClubMark";
import { socialImpactUnion } from "@/data/socialImpactUnion";

type ClubAccess = {
  isLoggedIn: boolean;
  isOfficialMember: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

type Props = {
  language: "en" | "ko";
  eccAccess: ClubAccess;
  hanhwalAccess: ClubAccess;
  onNavigate: () => void;
};

export function MobileNavigationMenu({ language, eccAccess, hanhwalAccess, onNavigate }: Props) {
  return (
    <div className="grid gap-1">
      <MenuLink href="/jeju/profile" onClick={onNavigate}>
        <UserRound aria-hidden className="h-6 w-6 shrink-0" />
        {language === "ko" ? "추억록 프로필 설정" : "My Journey profile"}
      </MenuLink>
      <ClubMenu club="ecc" access={eccAccess} language={language} onNavigate={onNavigate} />
      <ClubMenu club="hanhwal" access={hanhwalAccess} language={language} onNavigate={onNavigate} />
      <MenuLink href={socialImpactUnion.path} onClick={onNavigate}>
        <UsersRound aria-hidden className="h-6 w-6 shrink-0" />
        Social Impact Union
      </MenuLink>
    </div>
  );
}

function ClubMenu({ club, access, language, onNavigate }: {
  club: "ecc" | "hanhwal";
  access: ClubAccess;
  language: "en" | "ko";
  onNavigate: () => void;
}) {
  const korean = language === "ko";
  const label = club === "ecc" ? "ECC" : "Hanhwal";
  const base = `/our-activities/${club}`;

  return (
    <details className="group rounded-lg" data-club-menu={club}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-ink/76 transition hover:bg-white/60 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy [&::-webkit-details-marker]:hidden">
        <ClubMark id={club} size="xs" className="border-ink/10" />
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mb-2 ml-6 grid gap-1 border-l border-navy/15 pl-3">
        <MenuLink href={base} onClick={onNavigate}>{korean ? `${label} 홈` : `${label} home`}</MenuLink>
        {access.isLoggedIn && !access.isOfficialMember ? (
          <MenuLink href={`/${club}-join`} onClick={onNavigate}>
            {korean ? "신규회원 등록" : "New Member Registration"}
          </MenuLink>
        ) : null}
        {access.isOfficialMember ? (
          <>
            <MenuLink href={`/${club}-official`} onClick={onNavigate}>{label.toUpperCase()} OFFICIAL</MenuLink>
            <MenuLink href={`${base}/activity`} onClick={onNavigate}>{korean ? "활동 신청" : "Activity Application"}</MenuLink>
            <MenuLink href={`${base}/free-board`} onClick={onNavigate}>{korean ? "게시판" : "Board"}</MenuLink>
          </>
        ) : null}
        {access.isAdmin ? (
          <MenuLink href={`${base}/members`} onClick={onNavigate}>{korean ? "회원 관리" : "Member Management"}</MenuLink>
        ) : null}
        {(club === "ecc" ? access.isAdmin : access.isSuperAdmin) ? (
          <MenuLink href={`${base}/fund`} onClick={onNavigate}>{korean ? "자금 관리" : "Fund Management"}</MenuLink>
        ) : null}
        {club === "ecc" && access.isAdmin ? (
          <MenuLink href={`${base}/operations`} onClick={onNavigate}>{korean ? "학기 운영 설정" : "Semester Operations"}</MenuLink>
        ) : null}
      </div>
    </details>
  );
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-ink/76 transition hover:bg-white/60 hover:text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy">
      {children}
    </Link>
  );
}
