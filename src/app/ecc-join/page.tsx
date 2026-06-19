import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EccMemberRegistrationForm } from "@/components/EccMemberRegistrationForm";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "ECC New Member Registration",
  description: "Private ECC new member registration page for K_LINE Google-login users.",
  path: "/ecc-join"
});

export default async function EccJoinPage() {
  const access = await getCurrentEccAccess();

  if (access.isOfficialMember) {
    redirect("/ecc-official");
  }

  return (
    <section className="bg-paper py-8 md:py-16">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-brass">ECC</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink md:text-6xl">
            <I18nText en="ECC New Member Registration" ko="ECC 신규회원 등록" />
          </h1>
          <p className="mt-4 text-base leading-7 text-ink/68">
            <I18nText
              en="A clean mobile-friendly form for new ECC members joining through K_LINE."
              ko="K_LINE을 통해 ECC에 가입하는 신규회원을 위한 모바일 친화 등록폼입니다."
            />
          </p>
        </div>
        <EccMemberRegistrationForm />
      </div>
    </section>
  );
}
