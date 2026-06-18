import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccActivityPanel } from "@/components/EccActivityPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Activity",
  description:
    "Korean and English ECC activity application page with admin-only applicant, team, and notice management tools.",
  path: "/our-activities/ecc/activity"
});

export default async function EccActivityPage() {
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
          eyebrow={<I18nText en="ECC activity" ko="ECC 활동" />}
          title={<I18nText en="ECC Activity" ko="ECC 활동" />}
          description={
            <I18nText
              en="Choose a language and submit ECC activity applications. Admin controls appear only for admins and higher roles."
              ko="언어를 선택하고 ECC 활동을 신청할 수 있습니다. 관리자 기능은 관리자 이상에게만 표시됩니다."
            />
          }
        />
        <div className="mt-10">
          {access.isOfficialMember ? (
            <EccActivityPanel />
          ) : (
            <div className="paper-panel flex items-start gap-4 p-6 md:p-8">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-navy text-paper">
                <Lock aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-3xl font-semibold text-ink">
                  <I18nText en="ECC official membership required" ko="ECC 정식회원 권한이 필요합니다" />
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink/68">
                  <I18nText
                    en="Activity applications are available only after official ECC membership is confirmed."
                    ko="ECC 활동 신청은 정식회원 승인 후 이용할 수 있습니다."
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
