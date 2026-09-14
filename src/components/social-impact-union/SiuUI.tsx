"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, MapPin, Plus, RefreshCw, Users, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { activityPreferenceTaxonomy } from "@/lib/activity-preferences/taxonomy";
import { siuDate, siuPath, statusLabels, type SiuActivity } from "@/lib/siu/model";

export const siuButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white/60 px-4 py-3 text-sm font-semibold text-navy transition hover:bg-hanji disabled:cursor-not-allowed disabled:opacity-45";
export const siuPrimary = siuButton + " !bg-navy !text-paper hover:!bg-ink";
export const siuInput = "min-h-12 w-full min-w-0 rounded-xl border border-ink/20 bg-white/70 px-3 py-3 text-base text-ink focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20";
export function useSiuCopy() { const { language } = useLanguage(); const ko = language === "ko"; return { ko, t: (en: string, kr: string) => ko ? kr : en }; }
export async function siuFetch<T>(url: string, input?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: input === undefined ? "GET" : method, cache: "no-store", credentials: "same-origin",
    signal: signal ?? AbortSignal.timeout(15000), ...(input === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "SERVICE_UNAVAILABLE");
  return data;
}
const messages: Record<string, [string, string]> = {
  LOGIN_REQUIRED: ["Please log in to continue.", "로그인 후 이용해 주세요."],
  FORBIDDEN: ["You do not have permission.", "이 작업의 권한이 없습니다."],
  NOT_FOUND: ["Activity not found or unavailable.", "활동을 찾을 수 없거나 비공개 상태입니다."],
  STALE_ACTIVITY: ["This activity changed. Refresh before saving again.", "다른 변경이 있습니다. 새로고침 후 다시 저장해 주세요."],
  ALREADY_APPLIED: ["You already applied. Refresh to see your application.", "이미 신청했습니다. 새로고침하여 확인해 주세요."],
  APPLICATION_CLOSED: ["Applications are closed.", "신청이 마감되었습니다."],
  CAPACITY_REACHED: ["This activity is full.", "모집 정원이 찼습니다."],
  RATING_NOT_ELIGIBLE: ["Ratings open after the activity ends for applicants.", "활동 종료 후 신청자만 별점을 남길 수 있습니다."],
  ALREADY_RATED: ["Your rating is already saved.", "이미 별점이 저장되었습니다."],
  INVALID_CATEGORY: ["Select at least one activity category.", "활동 분야를 하나 이상 선택해 주세요."],
  INVALID_TAG: ["Use up to 10 tags: English letters, numbers, underscores (64 characters each).", "태그는 영문·숫자·밑줄로 각 64자, 최대 10개까지 입력해 주세요."],
  INVALID_DATE: ["Check the start, end and deadline dates.", "시작·종료·신청 마감 일시를 확인해 주세요."],
  INVALID_URL: ["Use a complete HTTPS URL.", "https://로 시작하는 전체 주소를 입력해 주세요."],
  START_MUST_BE_FUTURE: ["Published activities must start in the future.", "공개할 활동의 시작 일시는 미래여야 합니다."],
  READ_ONLY_DEVELOPER: ["This developer account is read-only.", "이 개발자 계정은 조회 전용입니다."],
  INVALID_ACTIVITY_STATE: ["Check capacity and status. Existing applications must be preserved.", "정원과 상태를 확인해 주세요. 기존 신청은 유지되어야 합니다."],
  ACTIVITY_LOCKED: ["A hidden or cancelled activity cannot be edited.", "숨김 또는 취소된 활동은 수정할 수 없습니다."],
  CANCELLATION_CLOSED: ["Cancellation closes when the activity starts.", "활동 시작 이후에는 신청을 취소할 수 없습니다."],
  CREATE_LIMIT: ["The daily activity creation limit has been reached.", "하루 활동 생성 한도에 도달했습니다."]
};
export function SiuErrorMessage({ error, retry }: { error: string; retry?: () => void }) {
  const { ko, t } = useSiuCopy();
  if (!error) return null;
  return <div role="alert" className="my-4 space-y-3 rounded-lg border border-red-700/20 bg-white/70 p-4 text-sm text-red-800">
    <p>{messages[error]?.[ko ? 1 : 0] || t("Unable to complete the request. Check your input or try again.", "요청을 처리하지 못했습니다. 입력 내용을 확인하거나 다시 시도해 주세요.")}</p>
    {retry && <button className={siuButton} onClick={retry}><RefreshCw className="h-4 w-4" />{t("Retry", "다시 시도")}</button>}
  </div>;
}
export function SiuLoading() { const { t } = useSiuCopy(); return <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted"><Loader2 className="h-5 w-5 animate-spin" />{t("Loading…", "불러오는 중…")}</p>; }
export function SiuShell({ children, title }: { children: ReactNode; title: string }) {
  const { t } = useSiuCopy();
  return <section className="bg-paper py-6 sm:py-12"><div className="mx-auto w-full max-w-5xl px-4 sm:px-6 md:px-8">
    <Link href={siuPath} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted"><ArrowLeft className="h-4 w-4" />Social Impact Union</Link>
    <h1 className="mt-4 break-words font-serif text-3xl font-semibold text-navy sm:text-4xl">{title}</h1>
    <nav aria-label="Social Impact Union" className="my-5 flex flex-wrap gap-2">
      <Link className={siuButton} href={siuPath + "/activities"}>{t("Activities", "활동")}</Link>
      <Link className={siuButton} href={siuPath + "/my"}>{t("My Activities", "내 활동")}</Link>
      <Link className={siuButton} href={siuPath + "/activities/create"}><Plus className="h-4 w-4" />{t("Create", "활동 만들기")}</Link>
    </nav>{children}
  </div></section>;
}
export function SiuCard({ activity, showDetails = true }: { activity: SiuActivity; showDetails?: boolean }) {
  const { ko, t } = useSiuCopy();
  const [imageFailed, setImageFailed] = useState(false);
  return <article className="paper-panel flex min-w-0 flex-col overflow-hidden">
    {activity.cover_image_url && !imageFailed && <img src={activity.cover_image_url} alt="" loading="lazy" referrerPolicy="no-referrer"
      className="aspect-[16/9] w-full bg-white object-cover" onError={() => setImageFailed(true)} />}
    <div className="flex flex-1 flex-col p-4 sm:p-6">
      <p className="text-xs font-semibold text-muted">{statusLabels[activity.status]?.[ko ? "ko" : "en"]}</p>
      <h2 className="mt-2 break-words text-xl font-bold leading-7 text-navy">{activity.title}</h2>
      <p className="mt-3 break-words text-sm leading-6 text-muted">{activity.short_description}</p>
      <div className="my-4 flex flex-wrap gap-2">{activity.categories?.map((id) => <span key={id} className="text-xs font-semibold text-navy">
        {activityPreferenceTaxonomy.find((c) => c.id === id)?.[ko ? "labelKo" : "labelEn"]}</span>)}</div>
      <div className="grid gap-2 text-sm text-ink">
        <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><span>{siuDate(activity.starts_at, ko)}</span></p>
        {activity.location_name && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{activity.location_name}</span></p>}
        {activity.application_count !== undefined && <p className="flex items-center gap-2"><Users className="h-4 w-4" />{activity.application_count}{activity.capacity ? " / " + activity.capacity : ""} {t("applications", "신청")}</p>}
        {activity.application_deadline && <p className="text-xs text-muted">{t("Deadline: ", "신청 마감: ")}{siuDate(activity.application_deadline, ko)}</p>}
      </div>
      {showDetails && <Link href={siuPath + "/activities/" + activity.id} className={siuButton + " mt-5"}>{t("View details", "자세히 보기")}<ArrowRight className="h-4 w-4" /></Link>}
    </div>
  </article>;
}
export function SiuConfirm({ title, busy, onConfirm, onClose }: { title: string; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useSiuCopy();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="siu-confirm-title"
    className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ink/20 bg-paper p-5 text-ink backdrop:bg-ink/30">
    <h2 id="siu-confirm-title" className="break-words text-lg font-bold">{title}</h2>
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      <button className={siuButton} onClick={onClose} disabled={busy}><X className="h-4 w-4" />{t("Cancel", "취소")}</button>
      <button className={siuPrimary} onClick={onConfirm} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("Confirm", "확인")}</button>
    </div>
  </dialog>;
}
