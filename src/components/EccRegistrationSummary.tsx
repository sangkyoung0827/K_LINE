"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { I18nText } from "@/components/LanguageProvider";

type Props = {
  status: string;
  description: string;
  avatarUrl: string;
  children: ReactNode;
};

export function EccRegistrationSummary({ status, description, avatarUrl, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <section className="paper-panel p-4 md:p-8">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-12 w-full items-center gap-3 text-left md:hidden"
      >
        <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-pine" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">
            <I18nText en="Registration submitted" ko="등록 제출 완료" />
          </span>
          <span className="mt-1 block break-words text-xs font-semibold text-pine">{status}</span>
        </span>
        <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-ink/60 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <div className="hidden flex-wrap items-start justify-between gap-5 md:flex">
        <div>
          <div className="inline-flex items-center gap-2 border border-pine/20 bg-pine/10 px-3 py-2 text-xs font-semibold uppercase text-pine">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            {status}
          </div>
          <h2 className="mt-5 font-serif text-3xl font-semibold text-ink">
            <I18nText en="Registration submitted" ko="등록이 제출되었습니다" />
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/68">{description}</p>
        </div>
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full border border-ink/10 object-cover" /> : null}
      </div>

      <div id={detailsId} className={expanded ? "block" : "hidden md:block"}>
        <p className="mt-4 border-t border-ink/10 pt-4 text-sm leading-7 text-ink/68 md:hidden">{description}</p>
        {children}
      </div>
    </section>
  );
}
