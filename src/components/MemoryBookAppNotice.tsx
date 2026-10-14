"use client";

import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

export function MemoryBookAppNotice() {
  const { pick } = useLanguage();
  return <section className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-xl flex-col items-center justify-center gap-6 px-5 py-10 text-center">
    <WoohyukmonGlassesIcon alt="" className="h-16 w-28" />
    <h1 className="font-serif text-3xl font-semibold text-navy">{pick({ ko: "추억록은 우혁몬 앱에서", en: "Memory Book in Woohyukmon" })}</h1>
    <p className="text-base leading-7 text-muted">{pick({ ko: "추억록은 우혁몬 애플리케이션으로 이동합니다. 기존 기록과 사진은 그대로 보존됩니다.", en: "Memory Book is moving to the Woohyukmon app. Your existing records and photos are preserved." })}</p>
    <p className="inline-flex items-center gap-2 text-sm text-muted"><Smartphone aria-hidden className="h-5 w-5" />{pick({ ko: "앱 설치 안내는 정식 출시 후 제공됩니다.", en: "Installation links will be available after the app launches." })}</p>
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-navy/15 px-5 font-semibold text-navy hover:bg-white"><ArrowLeft aria-hidden className="h-4 w-4" />{pick({ ko: "K_LINE 홈", en: "K_LINE home" })}</Link>
  </section>;
}
