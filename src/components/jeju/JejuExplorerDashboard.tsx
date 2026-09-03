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
      eyebrow={korean ? "K_LINE / 추억록" : "K_LINE / Memory Book"}
      title={korean ? "추억록" : "Korea Memory Book"}
      description={korean ? "대한민국 곳곳을 탐험하며 장소, 별점, 사진과 여행 기록을 쌓고 우혁몬과 다음 여정을 이어가세요." : "Make your own Korea Memory Book. Explore places across South Korea, save ratings and photos, and continue your journey with Woohyukmon."}
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
