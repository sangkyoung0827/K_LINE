import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { DonationPanel } from "@/components/DonationPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Fund Management",
  description:
    "ECC fund management page for super admins and developers.",
  path: "/our-activities/ecc/fund"
});

export default async function EccFundPage() {
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
          eyebrow={<I18nText en="ECC fund" ko="ECC 자금" />}
          title={<I18nText en="ECC Fund Management" ko="ECC 자금관리" />}
          description={
            <I18nText
              en="ECC fund and donation account information is visible and editable only for super admins and developers."
              ko="ECC 자금관리와 후원 계좌 정보는 슈퍼관리자와 개발자 권한에서만 확인하고 수정할 수 있습니다."
            />
          }
        />
        <div className="mt-10">
          {access.isSuperAdmin ? (
            <DonationPanel />
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
                    en="ECC fund management is visible only to super admins and developers."
                    ko="ECC 자금관리는 슈퍼관리자와 개발자 권한에서만 볼 수 있습니다."
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
