import type { Metadata } from "next";
import { createPublicMetadata } from "@/lib/seo";

const instagramUrl = "https://www.instagram.com/ecc_jbnu/";

export const metadata: Metadata = createPublicMetadata({
  title: "Contact",
  description: "Contact ECC through the official ECC Instagram or Woohyukmon.",
  path: "/contact",
  keywords: ["K_LINE contact", "ECC", "ECC Instagram", "Woohyukmon"]
});

export default function ContactPage() {
  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <h1 className="font-serif text-5xl font-semibold text-navy md:text-7xl">문의</h1>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="paper-panel group grid min-h-56 content-between p-6 transition hover:border-brass hover:bg-white/70 hover:shadow-soft md:p-8"
          >
            <div>
              <p className="text-sm font-semibold uppercase text-brass">Instagram</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-ink md:text-4xl">
                ECC 공식 인스타그램
              </h2>
            </div>
            <span className="mt-8 inline-flex w-fit items-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-paper transition group-hover:bg-ink">
              문의하기
            </span>
          </a>

          <div className="paper-panel grid min-h-56 content-between p-6 md:p-8">
            <div>
              <p className="text-sm font-semibold uppercase text-brass">Woohyukmon</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold text-ink md:text-4xl">
                우혁몬에게 문의하기
              </h2>
            </div>
            <span className="mt-8 inline-flex w-fit items-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-paper">
              오른쪽 아래 우혁몬 버튼 사용
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
