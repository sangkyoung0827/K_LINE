import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccActivityPanel } from "@/components/EccActivityPanel";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC Activity",
  description:
    "Korean and English ECC activity application page with super-admin-only applicant, team, and notice management tools.",
  path: "/our-activities/ecc/activity"
});

export default function EccActivityPage() {
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
              en="Choose a language and submit ECC activity applications. Super-admin controls appear only for the super admin."
              ko="언어를 선택하고 ECC 활동을 신청할 수 있습니다. 슈퍼관리자 기능은 슈퍼관리자에게만 표시됩니다."
            />
          }
        />
        <div className="mt-10">
          <EccActivityPanel />
        </div>
      </div>
    </section>
  );
}
