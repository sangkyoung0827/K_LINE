"use client";

import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { assistantProgressText } from "@/lib/woohyukmon/progress";

export function AssistantProgress({ active, stage }: { active: boolean; stage?: string }) {
  const { language } = useLanguage();
  if (!active) return null;
  return <p data-assistant-progress role="status" aria-live="polite" aria-atomic="true" className="flex min-h-6 min-w-0 items-start gap-2 py-1 text-sm leading-6 text-ink/60">
    <Loader2 aria-hidden className="mt-1 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
    <span className="min-w-0 break-words">{assistantProgressText(stage, language)}</span>
  </p>;
}
