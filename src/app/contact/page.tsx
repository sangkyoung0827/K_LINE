import type { Metadata } from "next";
import { Instagram, Send } from "lucide-react";
import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
import { createPublicMetadata } from "@/lib/seo";

const instagramUrl = "https://www.instagram.com/ecc_jbnu/";

export const metadata: Metadata = createPublicMetadata({
  title: "Woohyukmon",
  description: "Ask the K_LINE AI assistant Woohyukmon about ECC, K_LINE, registration, club administration, and site guidance.",
  path: "/contact",
  keywords: ["K_LINE", "Woohyukmon", "우혁몬", "ECC", "K_LINE AI"]
});

export default function ContactPage() {
  return (
    <section className="relative isolate overflow-hidden bg-paper px-5 py-14 md:px-8 md:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.92),transparent_30rem),radial-gradient(circle_at_50%_65%,rgba(214,168,90,0.12),transparent_30rem)]" />
      <div className="pointer-events-none absolute bottom-20 right-[8%] hidden text-6xl text-white/80 drop-shadow-sm md:block">
        ✦
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-14rem)] max-w-5xl flex-col items-center justify-center text-center">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <WoohyukmonGlassesIcon className="h-20 w-36 md:h-24 md:w-44" alt="우혁몬 안경 아이콘" />
          <div className="text-center sm:text-left">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-brass">K_LINE AI</p>
            <h1 className="mt-1 break-keep text-4xl font-medium tracking-[-0.04em] text-ink md:text-6xl">
              우혁몬
            </h1>
          </div>
        </div>

        <p className="mt-5 max-w-2xl break-keep text-sm font-medium leading-7 text-muted md:text-base">
          ECC와 K_LINE, 가입, 사이트 이용, 동아리 운영에 대해 무엇이든 물어보세요.
          이제 우혁몬은 이 메뉴 안에서 바로 대화할 수 있습니다.
        </p>

        <div className="mt-9 w-full">
          <WoohyukmonChatbot />
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex min-h-14 items-center gap-3 rounded-2xl border border-ink/10 bg-white/44 px-6 text-base font-medium text-ink shadow-[0_12px_34px_rgba(31,42,68,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brass/60 hover:bg-white/70"
        >
          <Instagram aria-hidden className="h-6 w-6" />
          ECC 공식 인스타그램으로 문의하기
          <Send aria-hidden className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}
