import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccMemberRegistrationForm } from "@/components/EccMemberRegistrationForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC New Member Registration",
  description:
    "Private K_LINE internal ECC New Member Registration form connected to Google login.",
  path: "/our-activities/ecc/register"
});

export default async function EccMemberRegistrationPage() {
  const access = await getCurrentEccAccess();

  if (!access.isLoggedIn) {
    redirect("/login?callbackUrl=/our-activities/ecc/register");
  }

  if (access.isOfficialMember) {
    redirect("/ecc-official");
  }

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
        <ClubMark id="ecc" size="lg" className="mb-6 border-ink/10" />
        <SectionHeader
          eyebrow={<I18nText en="ECC membership" ko="ECC 회원" />}
          title={<I18nText en="ECC New Member Registration" ko="ECC 신규회원 등록" />}
          description={
            <I18nText
              en="Submit the K_LINE internal ECC registration form. Officers approve official membership after payment confirmation."
              ko="K_LINE 내부 ECC 등록폼을 제출해 주세요. 운영진이 회비 납부를 확인하면 정식회원 권한이 승인됩니다."
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
