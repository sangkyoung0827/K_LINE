import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HanhwalMemberRegistrationForm } from "@/components/HanhwalMemberRegistrationForm";
import { I18nText } from "@/components/LanguageProvider";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { createNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = createNoIndexMetadata({
  title: "Hanhwal New Member Registration",
  description: "Private Hanhwal new member registration page for K_LINE Google-login users.",
  path: "/hanhwal-join"
});

export default async function HanhwalJoinPage() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isLoggedIn) {
    redirect("/login?callbackUrl=/hanhwal-join");
  }

  if (access.isOfficialMember) {
    redirect("/hanhwal-official");
  }

  return (
    <section className="bg-paper py-8 md:py-16">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-brass">Hanhwal</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-ink md:text-6xl">
            <I18nText en="Hanhwal New Member Registration" ko="한활 신규회원 등록" />
          </h1>
          <p className="mt-4 text-base leading-7 text-ink/68">
            <I18nText
              en="A clean mobile-friendly form for new Hanhwal members joining through K_LINE."
              ko="K_LINE을 통해 Hanhwal에 가입하는 신규회원을 위한 모바일 친화 등록폼입니다."
            />
          </p>
        </div>
        <HanhwalMemberRegistrationForm />
      </div>
    </section>
  );
}
