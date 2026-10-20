"use client";

import { Copy } from "lucide-react";
import { noticeBody } from "@/lib/googleForms/planning";
import { useLanguage } from "@/components/LanguageProvider";

export function ActivityNoticeOutput({ notice, applicationUrl, onError, showApplicationLink = true }: {
  notice: string;
  applicationUrl: string;
  onError: (message: string) => void;
  showApplicationLink?: boolean;
}) {
  const { language } = useLanguage();
  const t = (ko: string, en: string) => language === "ko" ? ko : en;
  const body = noticeBody(notice);
  function copy(value: string) {
    void navigator.clipboard.writeText(value).catch(() => onError("CLIPBOARD_COPY_FAILED"));
  }
  return <div className="space-y-5">
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("공지문", "Announcement")}</h3>
        <button title={t("공지문 복사", "Copy announcement")} aria-label={t("공지문 복사", "Copy announcement")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-ink/5" onClick={() => copy(body)}><Copy aria-hidden className="h-4 w-4" /></button>
      </div>
      <textarea aria-label={t("생성된 공지문", "Generated announcement")} readOnly rows={Math.max(20, body.split("\n").length + 12)} className="form-field mt-2 leading-relaxed" value={body} />
    </div>
    {showApplicationLink && <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t("신청 링크", "Application link")}</h3>
        <button disabled={!applicationUrl} title={t("신청 링크 복사", "Copy application link")} aria-label={t("신청 링크 복사", "Copy application link")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-ink/5 disabled:opacity-40" onClick={() => copy(applicationUrl)}><Copy aria-hidden className="h-4 w-4" /></button>
      </div>
      <textarea aria-label={t("신청 링크", "Application link")} readOnly rows={3} placeholder={t("아직 생성되지 않음", "Not created yet")} className="form-field mt-2 break-all text-sm" value={applicationUrl} />
    </div>}
  </div>;
}
