"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

export function MemberRosterExportButton({ club }: { club: "ecc" | "hanhwal" }) {
  const { language } = useLanguage();
  const busy = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/${club}/member-registrations/export`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) throw new Error("Export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `${club}-members.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(language === "ko" ? "명부를 다운로드하지 못했습니다. 권한과 연결 상태를 확인하고 다시 시도해 주세요." : "Could not download the roster. Check your access and connection, then try again.");
    } finally {
      busy.current = false;
      setDownloading(false);
    }
  };

  return (
    <div className="ml-auto grid max-w-full justify-items-end gap-2">
      <button type="button" onClick={download} disabled={downloading} aria-busy={downloading}
        title={language === "ko" ? "전체 등록 명부를 학번·이름 순서의 엑셀로 다운로드" : "Download all registrations as Excel: student ID, name"}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-ink/15 bg-white/55 px-4 text-sm font-semibold text-ink transition hover:border-navy/45 hover:bg-white/80 disabled:cursor-wait disabled:opacity-60">
        {downloading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Download aria-hidden className="h-4 w-4" />}
        <I18nText en="Export to Excel" ko="전산화하기" />
      </button>
      {error ? <p role="alert" className="max-w-md text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
