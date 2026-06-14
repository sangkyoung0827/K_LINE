import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { auth } from "@/auth";
import { EccMemberManagementPanel } from "@/components/EccMemberManagementPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { hasSuperAdminAccess } from "@/lib/admin";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Member Management",
  description: "Super-admin-only ECC member management and team chat invitation page.",
  path: "/our-activities/ecc/members"
});

export default async function EccMemberManagementPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const isSuperAdmin = await hasSuperAdminAccess(email);

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
        <SectionHeader
          eyebrow={<I18nText en="ECC member management" ko="ECC 회원 관리" />}
          title={<I18nText en="Member Management" ko="회원 관리" />}
          description={
            <I18nText
              en="Confirm membership fee payment, prepare team chat invitations, and manage KakaoTalk invite status."
              ko="회비 납부를 확인하고 팀채팅 초대 링크, QR, 카카오톡 초대 상태를 관리합니다."
            />
          }
        />
        <div className="mt-10">
          {isSuperAdmin ? (
            <EccMemberManagementPanel />
          ) : (
            <div className="paper-panel flex items-start gap-4 p-6 md:p-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
                <Lock aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-3xl font-semibold text-ink">
                  <I18nText en="Super-admin access required" ko="슈퍼관리자 권한이 필요합니다" />
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink/68">
                  <I18nText
                    en="Member management is visible only to super admins or developers."
                    ko="회원 관리는 슈퍼관리자 또는 개발자 권한으로 로그인한 경우에만 볼 수 있습니다."
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
