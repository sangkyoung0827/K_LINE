"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppWindow, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { labApiPath, type PublishedLab } from "@/lib/coDevelopment/model";
export function PublishedServices() {
  const [items, setItems] = useState<PublishedLab[]>([]);
  const { language } = useLanguage();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${labApiPath}/catalog`, { cache: "no-store", signal: controller.signal }).then(async r => { if (r.ok) setItems(await r.json()); }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <>{items.map(item => <Link key={item.id} href={`/services/${item.id}`} className="flex min-h-24 min-w-0 items-center gap-4 rounded-lg border border-ink/15 bg-white p-5 sm:min-h-[216px] sm:flex-col sm:items-start"><AppWindow aria-hidden size={28} /><div className="min-w-0 flex-1"><h2 className="break-words text-xl font-semibold [overflow-wrap:anywhere]">{item.title}</h2><p className="mt-2 break-words text-sm [overflow-wrap:anywhere]">{item.description}</p></div><ArrowUpRight size={20} aria-label={language === "ko" ? "열기" : "Open"} /></Link>)}</>;
}
