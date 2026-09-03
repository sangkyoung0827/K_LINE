"use client";

import Link from "next/link";
import { JejuExploreMap } from "@/components/jeju/JejuExploreMap";
import { JejuShell } from "@/components/jeju/JejuShell";
import { JejuWoohyukmonPanel } from "@/components/jeju/JejuWoohyukmonPanel";
import { MemoryBookStudio } from "@/components/jeju/MemoryBookStudio";
import { useLanguage } from "@/components/LanguageProvider";

export function JejuExplorerDashboard() {
  const { language } = useLanguage();
  const korean = language === "ko";

  return (
    <JejuShell
      showNavigation={false}
      eyebrow={korean ? "K_LINE / 추억록" : "K_LINE / Memory Book"}
      title={korean ? "추억록" : "Korea Memory Book"}
      description={korean ? "한국에서의 장소, 활동, 별점, 사진과 이동 기록을 모아 나만의 추억록을 만들어보세요." : "Turn your places, activities, ratings, photos, and movement across Korea into your own Memory Book."}
      actions={
        <Link href="/jeju/profile" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#0d5962] px-4 text-sm font-bold text-white transition hover:bg-[#073c44]">
          {korean ? "탐험 취향 설정" : "Exploration preferences"}
        </Link>
      }
    >
      <div className="mx-auto grid max-w-7xl gap-6 sm:gap-8">
        <MemoryBookStudio />
        <JejuExploreMap />
        <JejuWoohyukmonPanel embedded />
      </div>
    </JejuShell>
  );
}
