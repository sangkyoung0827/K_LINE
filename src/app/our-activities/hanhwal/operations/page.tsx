import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HanhwalOperationsManagementPanel } from "@/components/HanhwalOperationsManagementPanel";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "HANHWAL Semester Operations",
  description: "Admin-only HANHWAL semester operations settings.",
  path: "/our-activities/hanhwal/operations"
});

export default async function HanhwalOperationsPage() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isAdmin) {
    redirect("/hanhwal-official");
  }

  return (
    <section className="bg-paper py-10 sm:py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <p className="text-sm font-semibold uppercase text-brass">HANHWAL ADMIN</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">
          <I18nText en="Semester Operations" ko="학기 운영 설정" />
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
          <I18nText
            en="Replace only semester-specific operating information without touching member records or established application history."
            ko="회원 기록과 기존 신청 내역은 건드리지 않고 학기마다 바뀌는 운영 정보만 교체합니다."
          />
        </p>

        <div className="mt-8">
          <HanhwalOperationsManagementPanel />
        </div>
      </div>
    </section>
  );
}
