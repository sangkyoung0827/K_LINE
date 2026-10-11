"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function EventDeleteButton({ formId, title, disabled, onDeleted, onError }: {
  formId: string; title: string; disabled?: boolean; onDeleted: () => void | Promise<void>; onError: (message: string) => void;
}) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false), [ended, setEnded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const running = useRef(false);
  function close() { setOpen(false); setEnded(false); buttonRef.current?.focus(); }
  async function remove() {
    if (running.current || disabled || !ended) return;
    running.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/google-forms/forms/${encodeURIComponent(formId)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedEnded: true }), signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(ko ? "행사를 삭제하지 못했습니다. 새로고침 후 다시 시도해 주세요." : "Could not delete this event. Refresh and try again.");
      if (!result.deleted) throw new Error(ko ? "삭제 결과를 확인하지 못했습니다." : "Deletion was not confirmed.");
      close();
      await onDeleted();
    } catch (error) { onError((error as Error).message); }
    finally { running.current = false; setBusy(false); }
  }
  return <><button ref={buttonRef} type="button" aria-label={ko ? "행사 삭제" : "Delete event"} title={ko ? "종료된 행사 삭제" : "Delete an ended event"}
    disabled={disabled || busy} onClick={() => { setEnded(false); setOpen(true); }}
    className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-red-700/25 text-red-700 disabled:opacity-40">
    <Trash2 className="h-4 w-4" />
  </button>{open && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="w-full max-w-md rounded-lg bg-paper p-5 text-ink shadow-xl" onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)"));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <h2 id={headingId} className="text-lg font-semibold">{ko ? "종료된 행사 삭제" : "Delete an ended event"}</h2>
      <p className="mt-3 break-words font-semibold">{title}</p>
      <p className="mt-3 text-sm">{ko ? "행사 목록에서 삭제합니다. 구글폼 원본과 신청 응답·공지 기록은 보존됩니다." : "Remove this event from the list. The original Google Form, responses and notice records will be kept."}</p>
      <label className="mt-4 flex items-start gap-2 text-sm"><input autoFocus type="checkbox" disabled={busy} checked={ended} onChange={event => setEnded(event.target.checked)} className="mt-1" />{ko ? "행사가 종료되었음을 확인했습니다." : "I confirm that this event has ended."}</label>
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} className="min-h-11 border border-ink/20 px-4 text-sm" onClick={close}>{ko ? "취소" : "Cancel"}</button>
        <button type="button" disabled={!ended || busy || disabled} className="inline-flex min-h-11 items-center gap-2 bg-red-700 px-4 text-sm text-white disabled:opacity-40" onClick={() => void remove()}><Trash2 className="h-4 w-4" />{busy ? (ko ? "삭제 중..." : "Deleting...") : (ko ? "삭제" : "Delete")}</button></div>
    </div>
  </div>, document.body)}</>;
}
