"use client";

import Link from "next/link";
import { JejuGoogleMap } from "@/components/jeju/JejuGoogleMap";
import { JejuShell } from "@/components/jeju/JejuShell";
import { JejuWoohyukmonPanel } from "@/components/jeju/JejuWoohyukmonPanel";
import { useLanguage } from "@/components/LanguageProvider";

export function JejuExplorerDashboard() {
  const { language } = useLanguage();
  const korean = language === "ko";

  return (
    <JejuShell
      showNavigation={false}
      eyebrow={korean ? "K_LINE / 탐험" : "K_LINE / Explore"}
      title={korean ? "탐험" : "Explore"}
      description={korean ? "실시간 Google 지도와 우혁몬으로 제주를 탐험하세요." : "Explore Jeju with a live Google Map and Woohyukmon."}
      actions={
        <Link href="/jeju/profile" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">
          {korean ? "프로필 설정" : "Profile settings"}
        </Link>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 sm:gap-8">
        <JejuGoogleMap />
        <JejuWoohyukmonPanel embedded />
      </div>
    </JejuShell>
  );
}
