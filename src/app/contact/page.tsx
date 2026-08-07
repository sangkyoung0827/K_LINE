import type { Metadata } from "next";
import { ChevronDown, Instagram, Mic, Plus, Send } from "lucide-react";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
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
    <section className="relative isolate overflow-hidden bg-paper px-5 py-16 md:px-8 md:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.92),transparent_30rem),radial-gradient(circle_at_50%_65%,rgba(214,168,90,0.12),transparent_30rem)]" />
      <div className="pointer-events-none absolute bottom-20 right-[8%] hidden text-6xl text-white/80 drop-shadow-sm md:block">
        ✦
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-14rem)] max-w-6xl flex-col items-center justify-center text-center">
        <div className="flex items-center justify-center gap-4">
          <WoohyukmonGlassesIcon className="h-14 w-28 md:h-16 md:w-32" />
          <h1 className="break-keep text-4xl font-medium tracking-[-0.04em] text-ink md:text-6xl">
            상경님, 오후에요
          </h1>
        </div>

        <div className="mt-10 w-full max-w-4xl rounded-[2rem] border border-ink/10 bg-white/64 p-6 text-left shadow-[0_22px_60px_rgba(31,42,68,0.10)] backdrop-blur md:p-8">
          <p className="text-base font-medium text-ink/54 md:text-lg">스킬을 보려면 /를 입력하세요</p>

          <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center text-3xl font-light text-ink">
                <Plus aria-hidden className="h-6 w-6" />
              </span>
              <span className="inline-flex min-h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper shadow-soft">
                채팅
              </span>
              <span className="inline-flex min-h-10 items-center rounded-xl border border-ink/12 bg-ink px-4 text-sm font-semibold text-paper/82 shadow-soft">
                Cowork
              </span>
            </div>

            <div className="flex items-center justify-start gap-5 text-ink md:justify-end">
              <span className="inline-flex items-center gap-1 text-base font-medium">
                우혁몬 2.0
                <ChevronDown aria-hidden className="h-4 w-4" />
              </span>
              <Mic aria-hidden className="h-6 w-6" />
              <span className="flex h-8 items-center gap-1" aria-hidden>
                <span className="h-4 w-0.5 rounded-full bg-ink" />
                <span className="h-7 w-0.5 rounded-full bg-ink" />
                <span className="h-5 w-0.5 rounded-full bg-ink" />
                <span className="h-8 w-0.5 rounded-full bg-ink" />
                <span className="h-4 w-0.5 rounded-full bg-ink" />
              </span>
            </div>
          </div>
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-10 inline-flex min-h-16 items-center gap-4 rounded-2xl border border-ink/10 bg-white/44 px-6 text-lg font-medium text-ink shadow-[0_12px_34px_rgba(31,42,68,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brass/60 hover:bg-white/70 md:px-8 md:text-xl"
        >
          <Instagram aria-hidden className="h-7 w-7" />
          ECC 공식 인스타그램으로 문의하기
          <Send aria-hidden className="h-6 w-6" />
        </a>
      </div>
    </section>
  );
}
