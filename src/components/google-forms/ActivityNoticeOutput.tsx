"use client";

import { Copy } from "lucide-react";
import { noticeBody } from "@/lib/googleForms/planning";

export function ActivityNoticeOutput({ notice, applicationUrl, onError }: {
  notice: string;
  applicationUrl: string;
  onError: (message: string) => void;
}) {
  const body = noticeBody(notice);
  function copy(value: string) {
    void navigator.clipboard.writeText(value).catch(() => onError("복사에 실패했습니다."));
  }
  return <div className="space-y-5">
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">공지문</h3>
        <button title="공지문 복사" aria-label="공지문 복사" className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink/20" onClick={() => copy(body)}><Copy className="h-4 w-4" /></button>
      </div>
      <textarea aria-label="생성된 공지문" readOnly rows={Math.max(20, body.split("\n").length + 12)} className="form-field mt-2 leading-relaxed" value={body} />
    </div>
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">신청 링크</h3>
        <button disabled={!applicationUrl} title="신청 링크 복사" aria-label="신청 링크 복사" className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink/20 disabled:opacity-40" onClick={() => copy(applicationUrl)}><Copy className="h-4 w-4" /></button>
      </div>
      <textarea aria-label="신청 링크" readOnly rows={3} placeholder="아직 생성되지 않음" className="form-field mt-2 break-all text-sm" value={applicationUrl} />
    </div>
  </div>;
}
