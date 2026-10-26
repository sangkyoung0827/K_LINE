"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { defaultLabAppearance, labApiPath, type LabSettings } from "@/lib/coDevelopment/model";

export function CoDevelopmentCard({ personalize = false }: { personalize?: boolean }) {
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
  return <Link href="/co-development" aria-label={appearance.title} className="group relative flex min-h-[216px] min-w-0 flex-col overflow-hidden rounded-lg border border-ink/15 p-5 sm:min-h-[292px] sm:p-8" style={{ background: appearance.background, color: appearance.foreground }}>
    {appearance.cardHtml ? <iframe title={appearance.title} aria-hidden="true" tabIndex={-1} sandbox="allow-scripts" referrerPolicy="no-referrer" src={`${labApiPath}/card?v=${settings.version}`} className="pointer-events-none absolute inset-0 h-full w-full border-0" /> : <>
      <FlaskConical size={32} style={{ color: appearance.accent }} aria-hidden="true" />
      <h2 className="mt-5 break-words text-2xl font-semibold [overflow-wrap:anywhere]">{appearance.title}</h2>
      {appearance.description && <p className="mt-3 break-words text-sm leading-6 [overflow-wrap:anywhere]">{appearance.description}</p>}
      <ArrowUpRight size={20} className="mt-auto self-end pt-1" aria-hidden="true" />
    </>}
  </Link>;
}
