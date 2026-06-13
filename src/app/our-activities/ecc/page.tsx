import type { Metadata } from "next";
import { Users } from "lucide-react";
import { EccToolGrid } from "@/components/EccToolGrid";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { SuperAdminRequestPanel } from "@/components/SuperAdminRequestPanel";
import { seoKeywords, siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ECC Club Hub",
  description:
    "ECC club menu for the K_LINE board and activity application pages with role-aware super admin controls.",
  keywords: [...seoKeywords, "ECC", "ECC 자유게시판", "ECC 활동", "ECC 자금관리"],
  openGraph: {
    title: "ECC Club Hub | K_LINE",
    description: "Open the ECC board and activity page on K_LINE. Super-admin tools appear by role.",
    url: `${siteConfig.url}/our-activities/ecc`
  },
  alternates: {
    canonical: `${siteConfig.url}/our-activities/ecc`
  }
};

export default function EccHubPage() {
  return (
    <>
      <section className="bg-navy py-16 text-paper md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[1fr_auto] md:items-end md:px-8">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">
              <I18nText en="International Clubs / ECC" ko="국제 학생 클럽 / ECC" />
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold md:text-7xl">
              <I18nText en="ECC Menu" ko="ECC 메뉴" />
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-paper/74">
              <I18nText
                en="ECC keeps its board and activity application flow in one place. Management controls change according to the logged-in account role."
                ko="ECC 게시판과 활동 신청 흐름을 한곳에서 운영합니다. 같은 사이트 주소에서 로그인한 계정 권한에 따라 보이는 관리 기능만 달라집니다."
              />
            </p>
          </div>
          <div className="hidden h-20 w-20 items-center justify-center border border-paper/20 bg-paper/8 md:flex">
            <Users aria-hidden className="h-9 w-9 text-brass" />
          </div>
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="ECC tools" ko="ECC 도구" />}
            title={<I18nText en="ECC Board and Activity" ko="ECC 게시판과 ECC 활동" />}
            description={
              <I18nText
                en="General members see the ECC board and activity application flow. Super-admin tools appear only for the super admin."
                ko="일반회원에게는 ECC 게시판과 ECC 활동 신청 흐름만 보입니다. 슈퍼관리자 도구는 슈퍼관리자에게만 표시됩니다."
              />
            }
          />

          <EccToolGrid />
          <SuperAdminRequestPanel />
        </div>
      </section>
    </>
  );
}
