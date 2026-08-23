import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClubMark } from "@/components/ClubMark";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createPublicMetadata } from "@/lib/seo";

export const metadata: Metadata = createPublicMetadata({
  title: "Hanhwal",
  description:
    "Hanhwal is K_LINE's Korean traditional archery club with protected member activities, community records, and official club management.",
  path: "/our-activities/hanhwal",
  keywords: ["Hanhwal", "한활", "Korean traditional archery", "Korean archery", "campus club"]
});

export default async function HanhwalHubPage() {
  const access = await getCurrentHanhwalAccess();

  if (access.isOfficialMember) {
    redirect("/hanhwal-official");
  }

  return (
    <section className="bg-paper py-10 sm:py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <ClubMark id="hanhwal" size="lg" className="!h-16 !w-16 border-ink/10 sm:!h-24 sm:!w-24" />
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Korean Traditional Archery Club</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold text-navy sm:text-5xl md:text-7xl">
              <I18nText en="Hanhwal" ko="한활" />
            </h1>
          </div>
        </div>

        <div className="mt-6 border border-navy/10 bg-white p-5 shadow-soft sm:mt-10 sm:p-8 md:p-10">
          <h2 className="font-serif text-2xl font-semibold text-navy sm:text-3xl md:text-4xl">
            <I18nText en="New Member Registration" ko="신규 회원 등록" />
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
            <I18nText
              en="Register with your Google account. Hanhwal officers will confirm payment before opening the official member lounge."
              ko="Google 계정으로 등록하면 한활 운영진이 회비 납부를 확인한 뒤 정식회원 라운지를 열어드립니다."
            />
          </p>
          <Link
            href="/hanhwal-join"
            className="mt-5 inline-flex min-h-11 items-center bg-navy px-6 text-sm font-semibold text-white shadow-soft transition hover:bg-ink sm:mt-8 sm:min-h-12"
          >
            <I18nText en="Register" ko="등록하기" />
          </Link>
        </div>
      </div>
    </section>
  );
}
