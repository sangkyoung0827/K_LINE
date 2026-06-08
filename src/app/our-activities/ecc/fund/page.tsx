import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DonationPanel } from "@/components/DonationPanel";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ECC Fund Management",
  description:
    "ECC fund management page where members can view displayed balance and super admins can edit fund information.",
  keywords: [...seoKeywords, "ECC 자금관리", "ECC 후원", "K_LINE 후원"],
  openGraph: {
    title: "ECC Fund Management | K_LINE",
    description:
      "View ECC fund information and role-aware super admin controls on the K_LINE website.",
    url: `${siteConfig.url}/our-activities/ecc/fund`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/ecc/fund`
  }
};

export default function EccFundPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Link
          href="/our-activities/ecc"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Back to ECC Menu
        </Link>
        <SectionHeader
          eyebrow="ECC fund"
          title="ECC 자금관리"
          description="일반회원은 공개된 남은 금액과 후원 계좌를 확인할 수 있고, 슈퍼관리자는 로그인 후 같은 페이지에서 금액을 직접 입력할 수 있습니다."
        />
        <div className="mt-10">
          <DonationPanel />
        </div>
      </div>
    </section>
  );
}
