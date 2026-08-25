import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ClubMark } from "@/components/ClubMark";
import { DonationPanel } from "@/components/DonationPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Fund Management",
  description:
    "Check the remaining ECC balance. Administrators can update the current fund manually.",
  path: "/our-activities/ecc/fund"
});

export default async function EccFundPage() {
  const access = await getCurrentEccAccess();

  if (!access.isAdmin) {
    redirect("/ecc-official");
  }

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
              en="Check the remaining ECC balance. Administrators can update the current fund manually."
              ko="ECC의 남은 금액을 확인하고, 관리자 이상 권한에서 현재 자금을 직접 입력합니다."
            />
          }
        />
        <div className="mt-10">
          <DonationPanel canEdit={access.isAdmin} />
        </div>
      </div>
    </section>
  );
}
