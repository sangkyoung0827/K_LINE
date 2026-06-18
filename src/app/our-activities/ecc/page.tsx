import type { Metadata } from "next";
import { ClubMark } from "@/components/ClubMark";
import { EccMembershipCards } from "@/components/EccMembershipCards";
import { EccToolGrid } from "@/components/EccToolGrid";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "ECC Club Hub",
  description:
    "ECC on K_LINE is an international student club hub for campus English conversation, student activities, board posts, and cultural exchange.",
  path: "/our-activities/ecc",
  keywords: ["ECC", "international students", "campus culture", "student activities"]
});

export default async function EccHubPage() {
  const access = await getCurrentEccAccess();

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
              en="ECC menus change according to your confirmed role: general user, official member, admin, super admin, or developer."
              ko="ECC 메뉴는 일반회원, 정식회원, 관리자, 슈퍼관리자, 개발자 권한에 따라 다르게 표시됩니다."
              />
            </p>
          </div>
          <ClubMark id="ecc" size="xl" className="hidden border-4 border-white/70 shadow-lift md:inline-flex" />
        </div>
      </section>

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <SectionHeader
            eyebrow={<I18nText en="ECC tools" ko="ECC 도구" />}
            title={<I18nText en="ECC Board and Activity" ko="ECC 게시판과 ECC 활동" />}
            description={
              <I18nText
                en="General logged-in users see only new member registration. Official members and officers see the protected ECC OFFICIAL area."
                ko="일반 로그인 사용자는 신규 회원 등록만 볼 수 있고, 정식회원과 임원은 보호된 ECC OFFICIAL 영역을 볼 수 있습니다."
              />
            }
          />

          <EccMembershipCards role={access.role} />
          <EccToolGrid role={access.role} />
        </div>
      </section>
    </>
  );
}
