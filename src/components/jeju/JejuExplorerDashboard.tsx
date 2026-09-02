"use client";

import Link from "next/link";
import { JejuExploreMap } from "@/components/jeju/JejuExploreMap";
import { JejuShell } from "@/components/jeju/JejuShell";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonChatbot } from "@/components/WoohyukmonChatbot";

export function JejuExplorerDashboard() {
  const { language } = useLanguage();
  const korean = language === "ko";

  return (
    <JejuShell
      showNavigation={false}
      eyebrow={korean ? "K_LINE / 추억록" : "K_LINE / My Journey"}
      title={korean ? "추억록" : "My Journey"}
      description={korean ? "실시간 Google 지도에 여행을 기록하고, 우혁몬과 다음 여정을 이어가세요." : "Record your Jeju journey on a live Google Map, then continue with Woohyukmon."}
      actions={
        <Link href="/jeju/profile" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">
          {korean ? "프로필 설정" : "Profile settings"}
        </Link>
      }
    >
      <div className="mx-auto grid max-w-7xl gap-6 sm:gap-8">
        <JejuExploreMap />
        <WoohyukmonChatbot edition="4" />
      </div>
    </JejuShell>
  );
}
