import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { I18nText } from "@/components/LanguageProvider";
import { SectionHeader } from "@/components/SectionHeader";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact K_LINE for Goods, K-Culture Project, International Clubs, Han-hwal project, or general inquiries.",
  openGraph: {
    title: "Contact | K_LINE",
    description:
      "General inquiry, Goods inquiry, K-Culture Project inquiry, and International Clubs inquiry for K_LINE."
  }
};

export default function ContactPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.85fr_1.15fr] md:px-8">
        <div>
          <SectionHeader
            eyebrow={<I18nText en="Contact" ko="문의" />}
            title={<I18nText en="Open a cultural conversation" ko="문화적 대화를 시작하세요" />}
            description={
              <I18nText
                en="Use the form for Goods, K-Culture Project, International Clubs, Hanhwal project, or future collaboration inquiries."
                ko="상품, K-컬처 프로젝트, 국제 학생 클럽, 한활 프로젝트, 향후 협업 문의에 이 양식을 사용하세요."
              />
            }
          />
          <div className="mt-8 grid gap-4 text-sm text-ink/70">
            <p>
              <span className="font-semibold text-ink">
                <I18nText en="Email placeholder" ko="이메일 자리표시자" />:
              </span>{" "}
              {siteConfig.emailPlaceholder}
            </p>
            <p>
              <span className="font-semibold text-ink">YouTube:</span>{" "}
              <a href={siteConfig.youtube} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                https://www.youtube.com/@Weirdsang
              </a>
            </p>
            <p>
              <span className="font-semibold text-ink">Instagram:</span> {siteConfig.instagramPlaceholder}
            </p>
          </div>
          <Link
            href="/our-activities/ecc/fund"
            className="mt-8 inline-flex min-h-11 items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <I18nText en="ECC Fund Management" ko="ECC 자금관리" />
          </Link>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
