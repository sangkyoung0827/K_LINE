import type { Metadata } from "next";
import { Instagram, Send } from "lucide-react";
import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";
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
    <section className="relative isolate overflow-hidden bg-paper px-5 py-10 md:px-8 md:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.94),transparent_32rem),radial-gradient(circle_at_50%_70%,rgba(214,168,90,0.10),transparent_30rem)]" />

      <div className="relative mx-auto flex min-h-[calc(100svh-11rem)] w-full max-w-[1400px] flex-col items-center justify-center">
        <div className="w-full">
          <WoohyukmonChatbot />
        </div>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex min-h-14 items-center gap-3 rounded-2xl border border-ink/10 bg-white/50 px-6 text-base font-medium text-ink shadow-[0_12px_34px_rgba(31,42,68,0.07)] backdrop-blur transition hover:-translate-y-0.5 hover:border-brass/60 hover:bg-white/75"
        >
          <Instagram aria-hidden className="h-6 w-6" />
          ECC 공식 인스타그램으로 문의하기
          <Send aria-hidden className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}
