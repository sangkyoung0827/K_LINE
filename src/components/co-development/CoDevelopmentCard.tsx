"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FlaskConical } from "lucide-react";
import { defaultLabAppearance, labApiPath, type LabSettings } from "@/lib/coDevelopment/model";
import { homePortalCardClassName } from "@/components/homePortalCard";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

export function CoDevelopmentCard({ personalize = false }: { personalize?: boolean }) {
  const { language } = useLanguage();
  const [settings, setSettings] = useState<LabSettings>({ appearance: defaultLabAppearance, version: 0 });
  useEffect(() => {
    setSettings({ appearance: defaultLabAppearance, version: 0 });
    if (!personalize) return;
    const controller = new AbortController();
    void fetch(labApiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings_get" }), cache: "no-store", signal: controller.signal })
      .then(async response => { if (response.ok) setSettings(await response.json()); }).catch(() => {});
    return () => controller.abort();
  }, [personalize]);
  const appearance = settings.appearance;
  return <Link href="/co-development" aria-label={appearance.title} className={appearance.cardHtml ? `${homePortalCardClassName} min-h-[216px] overflow-hidden` : homePortalCardClassName}>
    {appearance.cardHtml ? <iframe title={appearance.title} aria-hidden="true" tabIndex={-1} sandbox="allow-scripts" referrerPolicy="no-referrer" src={`${labApiPath}/card?v=${settings.version}`} className="pointer-events-none absolute inset-0 h-full w-full border-0" /> : <>
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-[#dfeaf3] text-[#184b54] shadow-[0_14px_28px_rgba(31,42,68,0.12)] sm:h-16 sm:w-16"><FlaskConical aria-hidden className="h-6 w-6 sm:h-8 sm:w-8" /></span>
        <span className="hidden rounded-full bg-hanji/80 px-3 py-1 text-xs font-bold text-navy/80 sm:inline"><I18nText en="Development" ko="개발" /></span>
      </div>
      <div className="min-w-0 flex-1 sm:mt-6 md:mt-8">
        <h2 className="break-words font-serif text-xl font-semibold tracking-normal text-navy [overflow-wrap:anywhere] sm:text-3xl md:text-4xl">{appearance.title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted sm:hidden"><I18nText en="Projects & review" ko="프로젝트 개발 · 검토" /></p>
        <p className="mt-2 hidden break-words text-sm font-medium leading-6 text-muted sm:mt-4 sm:block sm:leading-7 md:mt-6 md:min-h-[4.5rem]">{appearance.description || (language === "ko" ? "프로젝트를 개발하고 검토를 요청합니다." : "Develop projects and submit them for review.")}</p>
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-navy sm:mt-6 md:mt-7"><span className="hidden sm:inline"><I18nText en="View Details" ko="자세히 보기" /></span><ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-1" /></span>
    </>}
  </Link>;
}
