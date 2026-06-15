import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { EccMemberRegistrationForm } from "@/components/EccMemberRegistrationForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "ECC New Member Registration",
  description:
    "ECC New Member Registration starts with ECC KakaoTalk Open Chat for 전북대 ECC, English Conversation Club, international students, and campus club guidance.",
  path: "/our-activities/ecc/register",
  keywords: [
    "ECC New Member Registration",
    "ECC 신규회원 등록",
    "ECC Open Chat",
    "전북대 ECC",
    "English Conversation Club",
    "international students",
    "campus club",
    "KakaoTalk Open Chat"
  ]
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
        <ClubMark id="ecc" size="lg" className="mb-6 border-ink/10" />
        <SectionHeader
          eyebrow={<I18nText en="ECC membership" ko="ECC 회원" />}
          title={<I18nText en="ECC New Member Registration" ko="ECC 신규회원 등록" />}
          description={
            <I18nText
              en="ECC uses KakaoTalk Open Chat as the first step for new member guidance. Please enter the Open Chat room first to check ECC information, membership fee instructions, official registration form, and contact information."
              ko="ECC 신규회원 등록은 먼저 오픈채팅방 입장 후 안내를 확인하는 방식으로 진행됩니다. 아직 회비를 납부하지 않은 경우 정식회원이 아니므로, 구체적인 개인정보는 정식회원 등록 구글폼에서만 수집합니다."
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
