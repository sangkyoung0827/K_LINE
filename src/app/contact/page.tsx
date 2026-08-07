import type { Metadata } from "next";
import { Instagram, Send } from "lucide-react";
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
    <section className="relative isolate min-h-[calc(100svh-92px)] overflow-hidden bg-paper px-5 py-16 md:px-8 md:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(214,168,90,0.13),transparent_28rem),radial-gradient(circle_at_90%_88%,rgba(255,255,255,0.72),transparent_18rem)]" />
      <div className="pointer-events-none absolute bottom-20 right-[12%] text-5xl text-white/80 drop-shadow-sm md:text-6xl">
        ✦
      </div>

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <div className="text-6xl leading-none md:text-7xl" aria-hidden>
          😎
        </div>
        <h1 className="mt-4 break-keep font-serif text-4xl font-semibold tracking-[-0.04em] text-navy md:text-6xl">
          무엇이든 물어보세요
        </h1>

        <div className="mt-10 w-full max-w-3xl rounded-[2rem] border border-navy/10 bg-white/62 p-5 text-left shadow-[0_24px_65px_rgba(31,42,68,0.10)] backdrop-blur md:p-7">
          <p className="text-sm font-medium text-ink/48">우혁몬에게 문의하려면 오른쪽 아래 버튼을 눌러주세요</p>
          <div className="mt-8 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper shadow-soft">
              우혁몬
            </span>
            <span className="text-sm font-semibold text-ink/60">AI 보조</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <div className="inline-flex min-h-14 items-center gap-3 rounded-2xl border border-navy/10 bg-white/62 px-6 py-4 text-sm font-semibold text-ink shadow-soft">
            <span aria-hidden className="text-xl">😎</span>
            우혁몬에게 문의하기
          </div>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-14 items-center gap-3 rounded-2xl border border-navy/10 bg-white/62 px-6 py-4 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-brass hover:bg-white"
          >
            <Instagram aria-hidden className="h-5 w-5" />
            ECC 공식 인스타그램으로 문의하기
            <Send aria-hidden className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
