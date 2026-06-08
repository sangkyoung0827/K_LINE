import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EccActivityPanel } from "@/components/EccActivityPanel";
import { SectionHeader } from "@/components/SectionHeader";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ECC Activity",
  description:
    "ECC activity management page for member status, activity records, automatic team grouping, and KakaoTalk-ready notice drafts.",
  keywords: [...seoKeywords, "ECC 활동", "ECC 회원 현황", "ECC 조 편성", "카카오톡 공지"],
  openGraph: {
    title: "ECC Activity | K_LINE",
    description:
      "Manage ECC member status, activity participation, team grouping, and KakaoTalk-ready notices.",
    url: `${siteConfig.url}/our-activities/ecc/activity`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/ecc/activity`
  }
};

export default function EccActivityPage() {
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
          eyebrow="ECC activity"
          title="ECC 활동"
          description="회원 현황을 붙여넣어 활동 참여 내용을 정리하고, 이름 목록으로 조를 자동 편성한 뒤 카카오톡 공지문까지 만들 수 있습니다."
        />
        <div className="mt-10">
          <EccActivityPanel />
        </div>
      </div>
    </section>
  );
}
