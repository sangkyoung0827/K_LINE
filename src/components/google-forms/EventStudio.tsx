"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Glasses, Plus, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { StudioAccess } from "@/lib/eventStudio/access";
import type { EventPlan, StudioClub } from "@/lib/eventStudio/model";
import type { StudioJob } from "@/lib/eventStudio/service";
import { ActivityNoticeOutput } from "./ActivityNoticeOutput";

type Preview = { job: StudioJob; token: string | null; creationSupported: boolean; missing: string[];
  form?: { edit_url: string; responder_url: string }; notice?: string; applicationUrl?: string; recruitmentOpen?: boolean };
type Config = { jobs: StudioJob[]; access: StudioAccess; aiEnabled: boolean };
const clubNames: Record<StudioClub, string> = { ecc: "ECC", hanhwal: "HANHWAL", social_impact_union: "Social Impact Union" };
export async function studioCommand<T>(body: object): Promise<T> {
  const response = await fetch("/api/event-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(160000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "EVENT_STUDIO_UNAVAILABLE");
  return result;
}
const errors: Record<string, [string, string]> = {
  EVENT_AI_DISABLED: ["행사 전용 AI가 아직 활성화되지 않았습니다.", "Event AI has not been enabled yet."],
  OPENAI_SERVER_KEY_REQUIRED: ["서버의 OpenAI 연결 설정이 필요합니다.", "A server OpenAI connection is required."],
  EVENT_AI_CONFIGURATION_REQUIRED: ["행사 AI 모델 설정을 확인해주세요.", "Check the event AI model settings."],
  EVENT_AI_MODEL_UNAVAILABLE: ["설정된 모델을 이 API 계정에서 사용할 수 없습니다.", "This API account cannot access the configured model."],
  EVENT_AI_QUOTA_EXCEEDED: ["오늘의 AI 사용 한도에 도달했습니다.", "The daily AI limit has been reached."],
  APPROVAL_EXPIRED_OR_CHANGED: ["승인이 만료되었거나 초안이 변경되었습니다. 다시 확인해주세요.", "Approval expired or the draft changed. Review it again."],
  JOB_CHANGED_REVIEW_AGAIN: ["다른 화면에서 초안이 변경되었습니다. 다시 불러와주세요.", "The draft changed elsewhere. Reload it."],
  FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED: ["Google 생성 결과 확인이 필요합니다. 새 폼을 만들지 않고 복구를 기다립니다.", "Google's result is uncertain. Reconcile it before creating another form."],
  GOOGLE_RECONNECT_REQUIRED: ["Google 연결을 다시 승인해주세요.", "Reconnect your Google account."],
  CLUB_ADMIN_REQUIRED: ["해당 클럽의 관리자 권한이 필요합니다.", "Administrator access for this club is required."],
  EVENT_STUDIO_UNAVAILABLE: ["Event Studio 연결을 확인해주세요. 기존 신청 기능은 계속 사용할 수 있습니다.", "Check the Event Studio connection. Existing applications remain available."],
};
export function EventStudio({ initialClub, onComplete, embedded = false }: { initialClub?: StudioClub; onComplete?: () => void; embedded?: boolean }) {
  const { language } = useLanguage(); const ko = language === "ko";
  const t = (kr: string, en: string) => ko ? kr : en;
  const [config, setConfig] = useState<Config | null>(null), [clubKey, setClub] = useState<StudioClub>(initialClub || "ecc");
  const [message, setMessage] = useState(""), [result, setResult] = useState<Preview | null>(null), [plan, setPlan] = useState<EventPlan | null>(null);
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  const [usage, setUsage] = useState<{ usage: { id: string; actual_model: string; duration_ms: number; estimated_cost_usd: number | null; error_code: string | null }[] } | null>(null);
  const [userCap, setUserCap] = useState(10), [clubCap, setClubCap] = useState(50);
  async function load() {
    const next = await studioCommand<Config>({ action: "list" }); setConfig(next);
    if (!next.access.manageableClubs.includes(clubKey) && next.access.manageableClubs[0]) setClub(next.access.manageableClubs[0]);
  }
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  useEffect(() => { if (initialClub) { setClub(initialClub); setResult(null); setPlan(null); setUsage(null); } }, [initialClub]);
  function select(next: Preview) { setResult(next); setPlan(next.job.plan); setDirty(false); }
  function edit(update: Partial<EventPlan>) { if (plan) { setPlan({ ...plan, ...update }); setDirty(true); } }
  async function run(action: string) {
    if (busy) return; setBusy(true); setError("");
    try {
      const next = await studioCommand<Preview>({ action, clubKey, message, jobId: result?.job.id, revision: result?.job.revision,
        ...(action === "update" ? { plan } : {}), ...(action === "approve" ? { confirmed: true, token: result?.token } : {}) });
      select(next); await load(); if (action === "approve") onComplete?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visibleJobs = config?.jobs.filter(j => j.club_key === clubKey) || [];
  const readOnly = Boolean(config?.access.readOnly);
  return <section className={embedded ? "mt-7 min-w-0 space-y-5 text-ink" : "mx-auto w-full max-w-5xl space-y-5 px-4 py-5 text-ink sm:px-6"}>
    <h2 className="flex items-center gap-2 text-xl font-semibold">{embedded ? <><Glasses className="h-6 w-6 shrink-0" />{t("우혁몬 5.0", "WOOHYUKMON 5.0")}</> : "Event Studio"}</h2>
    {!embedded && <div className="flex flex-wrap items-center gap-3">
      <select aria-label={t("클럽", "Club")} disabled={busy} className="form-field min-w-0 max-w-full" value={clubKey} onChange={e => { setClub(e.target.value as StudioClub); setResult(null); setPlan(null); setUsage(null); }}>{(config?.access.manageableClubs || [clubKey]).map(c => <option key={c} value={c}>{clubNames[c]}</option>)}</select>
      <button title={t("새로고침", "Refresh")} aria-label={t("새로고침", "Refresh")} className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink/20" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}><RefreshCw className="h-4 w-4" /></button>
    </div>}
    {!config?.aiEnabled && config && <p role="status" className="text-sm text-ink/65">{t("행사 전용 AI 연결을 준비 중입니다. 저장된 초안은 계속 확인할 수 있습니다.", "Event AI is not enabled yet. Saved drafts remain accessible.")}</p>}
    {!readOnly && <form onSubmit={e => { e.preventDefault(); void run("plan"); }} className="flex items-end gap-2">
      <textarea aria-label={t("행사 계획", "Event request")} disabled={busy} className="form-field min-h-28 min-w-0 flex-1" placeholder={t("어떤 행사를 만들까요?", "What event would you like to create?")} value={message} onChange={e => setMessage(e.target.value)} />
      <button aria-label={t("행사 기획", "Plan event")} title={t("행사 기획", "Plan event")} disabled={busy || !message.trim() || !config?.aiEnabled} className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper disabled:opacity-40"><Send className="h-5 w-5" /></button>
    </form>}
    {busy && <p role="status" className="text-sm">{t("작업을 확인하고 있습니다. 잠시 기다려주세요.", "Checking this step. Please wait.")}</p>}
    {error && <p role="alert" className="break-words text-sm text-red-700">{errors[error]?.[ko ? 0 : 1] || `${t("작업을 완료하지 못했습니다", "This step could not be completed")}: ${error}`}</p>}
    {visibleJobs.length > 0 && <div className="grid gap-2"><label className="text-sm font-semibold" htmlFor="studio-drafts">{t("저장된 행사", "Saved events")}</label><select id="studio-drafts" className="form-field" value={result?.job.id || ""} disabled={busy} onChange={e => { if (e.target.value) { setBusy(true); void studioCommand<Preview>({ action: "get", jobId: e.target.value }).then(select).catch(e => setError(e.message)).finally(() => setBusy(false)); } }}><option value="">{t("선택", "Select")}</option>{visibleJobs.map(job => <option key={job.id} value={job.id}>{job.plan.title}</option>)}</select></div>}
    {result && plan && <div className="space-y-4 border-t border-ink/15 pt-5">
      <p className="text-sm text-ink/60">{clubNames[plan.clubKey]} · {t("초안 버전", "Draft version")} {result.job.revision} · {result.job.ai_metadata.model as string}</p>
      {!result.creationSupported && <p role="status" className="text-sm">{t("이 클럽은 기획·공지 초안까지 지원합니다. 행사·공지 저장 연결은 준비 중이며 Google Form을 실행하지 않습니다.", "Planning and notice drafts are supported. The club storage adapter is not ready; Google Forms creation is disabled.")}</p>}
      {result.job.state === "notice_saved" && result.form ? <>
        <h2 className="text-xl font-semibold">{plan.title}</h2>
        <p role="status" className="text-sm">{t("폼과 공지 초안이 저장되었습니다. 모집은 아직 시작되지 않았습니다.", "The form and private notice draft are saved. Recruitment has not started.")}</p>
        <a className="inline-flex min-h-11 items-center border border-ink/20 px-4 text-sm" href={result.form.edit_url} target="_blank" rel="noopener noreferrer">{t("구글폼 원본 보기", "Open original Google Form")}</a>
        <ActivityNoticeOutput notice={result.notice || ""} applicationUrl={result.applicationUrl || ""} onError={setError} />
      </> : <>
        <fieldset disabled={readOnly || busy || result.job.state !== "draft"} className="min-w-0 space-y-4 disabled:opacity-70">
          <label className="grid gap-2 text-sm">{t("제목", "Title")}<input className="form-field" value={plan.title} onChange={e => edit({ title: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">{(["descriptionKo", "descriptionEn"] as const).map(key => <label className="grid gap-2 text-sm" key={key}>{key === "descriptionKo" ? t("한국어 소개", "Korean introduction") : t("영어 소개", "English introduction")}<textarea className="form-field min-h-24" value={plan[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{(["activityDate", "applicationDeadline", "location", "capacity"] as const).map(key => <label className="grid gap-2 text-sm" key={key}>{({ activityDate: t("행사 일시 (ISO)", "Event date (ISO)"), applicationDeadline: t("신청 마감 (ISO)", "Deadline (ISO)"), location: t("장소", "Venue"), capacity: t("정원", "Capacity") })[key]}<input type={key === "capacity" ? "number" : "text"} min={key === "capacity" ? 1 : undefined} className="form-field" value={plan[key] ?? ""} onChange={e => edit({ [key]: key === "capacity" ? e.target.value ? Number(e.target.value) : null : e.target.value || null })} /></label>)}</div>
          <ol className="space-y-4">{plan.questions.map((q, index) => <li key={q.id} className="space-y-2 border-b border-ink/10 pb-3">
            <input aria-label={t(`질문 ${index + 1}`, `Question ${index + 1}`)} className="form-field" value={q.title} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, title: e.target.value } : item) })} />
            <div className="flex flex-wrap items-center gap-2"><select aria-label={t("질문 유형", "Question type")} className="form-field w-auto max-w-full" value={q.type} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, type: e.target.value as typeof q.type, options: ["multiple_choice", "checkbox", "dropdown"].includes(e.target.value) ? item.options : [] } : item) })}>{["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown", "date", "time"].map(type => <option key={type}>{type}</option>)}</select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={q.required} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, required: e.target.checked } : item) })} />{t("필수", "Required")}</label>
              {[-1, 1].map(offset => <button type="button" key={offset} aria-label={offset < 0 ? "Move up" : "Move down"} title={offset < 0 ? "Move up" : "Move down"} className="flex h-11 w-11 items-center justify-center border border-ink/20 disabled:opacity-30" disabled={index + offset < 0 || index + offset >= plan.questions.length} onClick={() => { const questions = [...plan.questions]; [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]]; edit({ questions }); }}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}
              <button type="button" aria-label="Delete question" title="Delete question" className="flex h-11 w-11 items-center justify-center border border-ink/20" onClick={() => edit({ questions: plan.questions.filter(item => item.id !== q.id) })}><Trash2 className="h-4 w-4" /></button>
            </div>
            {["multiple_choice", "checkbox", "dropdown"].includes(q.type) && <textarea aria-label={t("선택지", "Choices")} className="form-field min-h-24" value={q.options.join("\n")} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, options: e.target.value.split("\n") } : item) })} />}
          </li>)}</ol>
          <button type="button" className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm" onClick={() => edit({ questions: [...plan.questions, { id: crypto.randomUUID(), title: "", type: "short_answer", required: false, options: [] }] })}><Plus className="h-4 w-4" />{t("질문 추가", "Add question")}</button>
          {(["noticeKo", "noticeEn"] as const).map(key => <label key={key} className="grid gap-2 text-sm">{key === "noticeKo" ? t("한국어 공지", "Korean notice") : t("영어 공지", "English notice")}<textarea className="form-field min-h-48" value={plan[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}
        </fieldset>
        {result.missing.length > 0 && <p role="status" className="text-sm">{t("확인할 정보", "Missing information")}: {result.missing.join(", ")}</p>}
        {!readOnly && <div className="flex flex-wrap gap-2">
          <button disabled={busy || !dirty} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm disabled:opacity-40" onClick={() => void run("update")}><Save className="h-4 w-4" />{t("초안 저장", "Save draft")}</button>
          <button disabled={busy || dirty || !result.creationSupported || result.missing.length > 0} className="min-h-11 border border-ink/20 px-4 text-sm disabled:opacity-40" onClick={() => void run(result.job.state === "running" ? "recover" : "review")}>{t("승인 새로 확인", "Renew approval")}</button>
          <button disabled={busy || dirty || !result.token || result.job.state === "running"} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-paper disabled:opacity-40" onClick={() => void run("approve")}><Check className="h-4 w-4" />{t("승인 · 비공개 폼 생성", "Approve private form creation")}</button>
        </div>}
      </>}
    </div>}
    {config && (!embedded || result) && <details className="border-t border-ink/15 pt-4"><summary className="cursor-pointer text-sm font-semibold">{t("AI 사용량", "AI usage")}</summary>
      <button className="mt-3 min-h-11 border border-ink/20 px-4 text-sm" disabled={busy} onClick={() => void studioCommand<typeof usage>({ action: "usage", clubKey }).then(setUsage).catch(e => setError(e.message))}>{t("조회", "View")}</button>
      {usage && <ul className="mt-3 space-y-2 text-xs">{usage.usage.map(row => <li key={row.id}>{row.actual_model} · {row.duration_ms}ms · {row.estimated_cost_usd === null ? t("비용 미확인", "Cost unknown") : `$${row.estimated_cost_usd.toFixed(6)}`} {row.error_code}</li>)}</ul>}
      {config.access.canSetLimits && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void studioCommand({ action: "limits", clubKey, userDailyLimit: userCap, clubDailyLimit: clubCap }).catch(e => setError(e.message)); }}><label className="grid gap-1 text-sm">{t("사용자별 일일 호출", "Daily calls per user")}<input className="form-field w-24" type="number" min="1" max="100" value={userCap} onChange={e => setUserCap(Number(e.target.value))} /></label><label className="grid gap-1 text-sm">{t("클럽별 일일 호출", "Daily calls per club")}<input className="form-field w-24" type="number" min="1" max="1000" value={clubCap} onChange={e => setClubCap(Number(e.target.value))} /></label><button className="min-h-11 border border-ink/20 px-4 text-sm">{t("한도 저장", "Save limits")}</button></form>}
    </details>}
  </section>;
}
