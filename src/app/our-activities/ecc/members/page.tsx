import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccMemberRegistrationManagementPanel } from "@/components/EccMemberRegistrationManagementPanel";
import { EccPermissionManagementPanel } from "@/components/EccPermissionManagementPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Member Management",
  description: "Admin-only ECC member registration approval and permission control page.",
  path: "/our-activities/ecc/members"
});

export default async function EccMemberManagementPage() {
  const access = await getCurrentEccAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Link
          href="/our-activities/ecc"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          <I18nText en="Back to ECC Menu" ko="ECC 메뉴로 돌아가기" />
        </Link>
        <ClubMark id="ecc" size="lg" className="mb-6 border-ink/10" />
        <SectionHeader
          eyebrow={<I18nText en="ECC member management" ko="ECC 회원 관리" />}
          title={<I18nText en="Member Management" ko="회원 관리" />}
          description={
            <I18nText
              en="Confirm K_LINE new member registrations and process ECC permission requests."
              ko="K_LINE 신규회원 등록을 확인하고 ECC 권한 요청을 처리합니다."
            />
          }
        />
        <div className="mt-10">
          {access.isAdmin ? (
            <div className="grid gap-8">
              <EccMemberRegistrationManagementPanel />
              <EccPermissionManagementPanel />
            </div>
          ) : (
            <div className="paper-panel flex items-start gap-4 p-6 md:p-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
                <Lock aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-3xl font-semibold text-ink">
                  <I18nText en="Admin access required" ko="관리자 권한이 필요합니다" />
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink/68">
                  <I18nText
                    en="Member management is visible only to admins, super admins, or developers."
                    ko="회원 관리는 관리자, 슈퍼관리자, 개발자 권한으로 로그인한 경우에만 볼 수 있습니다."
                  />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
