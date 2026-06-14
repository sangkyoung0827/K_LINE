import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EccMemberRegistrationForm } from "@/components/EccMemberRegistrationForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC New Member Registration",
  description: "ECC new member registration form.",
  path: "/our-activities/ecc/register"
});

export default function EccMemberRegistrationPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Link
          href="/our-activities/ecc"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          <I18nText en="Back to ECC Menu" ko="ECC 메뉴로 돌아가기" />
        </Link>
        <SectionHeader
          eyebrow={<I18nText en="ECC membership" ko="ECC 회원" />}
          title={<I18nText en="New Member Registration" ko="신규 회원 등록" />}
          description={
            <I18nText
              en="Register first, then officers can confirm membership fee payment and prepare the team chat invitation."
              ko="먼저 등록하면 임원이 회비 납부를 확인하고 팀채팅 초대를 준비할 수 있습니다."
            />
          }
        />
        <div className="mt-10">
          <EccMemberRegistrationForm />
        </div>
      </div>
    </section>
  );
}
