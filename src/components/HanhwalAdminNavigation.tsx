"use client";

import Link from "next/link";
import { useHanhwalAccess } from "@/hooks/useHanhwalAccess";
import { I18nText } from "@/components/LanguageProvider";

export function HanhwalAdminNavigation() {
  const access = useHanhwalAccess();
  if (!access.isOfficialMember) return null;
  return <>
    <Link href="/hanhwal-official"><I18nText en="Official" ko="공식 메뉴" /></Link>
    {access.isAdmin ? <Link href="/our-activities/hanhwal/members"><I18nText en="Member Management" ko="회원 관리" /></Link> : null}
  </>;
}
