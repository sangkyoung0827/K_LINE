import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { EccMemberRegistrationManagementPanel } from "@/components/EccMemberRegistrationManagementPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Member Registration Admin",
  description: "Admin-only ECC internal new member registration approval page.",
  path: "/admin/ecc-members"
});

export default async function AdminEccMembersPage() {
  const access = await getCurrentEccAccess();

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Link
          href="/our-activities/ecc/members"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          <I18nText en="Back to ECC Member Management" ko="ECC 회원 관리로 돌아가기" />
        </Link>
        <SectionHeader
          eyebrow={<I18nText en="Admin only" ko="관리자 전용" />}
          title={<I18nText en="ECC New Member Approval" ko="ECC 신규회원 승인" />}
          description={
            <I18nText
              en="Confirm payment for K_LINE internal ECC registrations and approve official member access."
              ko="K_LINE 내부 ECC 신규회원 등록의 회비 납부를 확인하고 정식회원 권한을 승인합니다."
            />
          }
        />
        <div className="mt-10">
          {access.isAdmin ? (
            <EccMemberRegistrationManagementPanel />
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
                    en="ECC member approvals are visible only to admins, super admins, or developers."
                    ko="ECC 회원 승인은 관리자, 슈퍼관리자, 개발자 권한으로 로그인한 경우에만 볼 수 있습니다."
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
