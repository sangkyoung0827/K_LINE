"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Check, ChevronDown, ChevronUp, Glasses, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { StudioAccess } from "@/lib/eventStudio/access";
import type { EventPlan, StudioClub } from "@/lib/eventStudio/model";
import type { StudioJob } from "@/lib/eventStudio/service";
import { eventClarification } from "@/lib/eventStudio/clarification";
import { ActivityNoticeOutput } from "./ActivityNoticeOutput";
import { EventDeleteButton } from "./EventDeleteButton";

export type StudioPreview = { job: StudioJob; token: string | null; creationSupported: boolean; missing: string[]; clarification?: { ko: string; en: string };
  form?: { edit_url: string; responder_url: string }; notice?: string; applicationUrl?: string; recruitmentOpen?: boolean; archiveLinkPending?: boolean };
type Config = { jobs: StudioJob[]; access: StudioAccess; aiEnabled: boolean };
const questionLabels: Record<string, [string, string]> = { short_answer: ["단답형", "Short answer"], paragraph: ["서술형", "Paragraph"], multiple_choice: ["객관식", "Multiple choice"], checkbox: ["복수 선택", "Checkboxes"], dropdown: ["드롭다운", "Dropdown"], date: ["날짜", "Date"], time: ["시간", "Time"] };
export async function studioCommand<T>(body: object): Promise<T> {
  const response = await fetch("/api/event-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(160000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "EVENT_STUDIO_UNAVAILABLE");
  return result;
}
const errors: Record<string, [string, string]> = {
  CLIPBOARD_COPY_FAILED: ["복사하지 못했습니다. 내용을 선택해 복사해주세요.", "Could not copy. Select the text and copy it manually."],
  EVENT_AI_DISABLED: ["행사 전용 AI가 아직 활성화되지 않았습니다.", "Event AI has not been enabled yet."],
  OPENAI_SERVER_KEY_REQUIRED: ["서버의 OpenAI 연결 설정이 필요합니다.", "A server OpenAI connection is required."],
  EVENT_AI_CONFIGURATION_REQUIRED: ["행사 AI 모델 설정을 확인해주세요.", "Check the event AI model settings."],
  EVENT_AI_MODEL_UNAVAILABLE: ["설정된 모델을 이 API 계정에서 사용할 수 없습니다.", "This API account cannot access the configured model."],
  EVENT_AI_QUOTA_EXCEEDED: ["오늘의 AI 사용 한도에 도달했습니다.", "The daily AI limit has been reached."],
  APPROVAL_EXPIRED_OR_CHANGED: ["승인이 만료되었거나 초안이 변경되었습니다. 다시 확인해주세요.", "Approval expired or the draft changed. Review it again."],
  JOB_CHANGED_REVIEW_AGAIN: ["다른 화면에서 초안이 변경되었습니다. 다시 불러와주세요.", "The draft changed elsewhere. Reload it."],
  FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED: ["Google 생성 결과 확인이 필요합니다. 새 폼을 만들지 않고 복구를 기다립니다.", "Google's result is uncertain. Reconcile it before creating another form."],
  GOOGLE_RECONNECT_REQUIRED: ["Google 연결을 다시 승인해주세요.", "Reconnect your Google account."],
  EVENT_SCOPE_MISMATCH: ["현재 활동의 단체와 요청한 단체가 다릅니다. 개인 행사는 Event Studio에서 새로 만들어 주세요.", "The request does not match this club. Start a new personal event in Event Studio."],
  EVENT_ORGANIZER_AMBIGUOUS: ["어느 단체의 행사인가요? 주최 단체 하나를 알려주세요.", "Which organization is hosting this event?"],
  GOOGLE_AUTH_UNAVAILABLE: ["Google 인증 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", "Google authentication is temporarily unavailable. Try again shortly."],
  EVENT_DEADLINE_TIME_REQUIRED: ["신청 마감은 몇 시인가요? 시간과 시간대를 확인해 주세요.", "What time do applications close? Specify the time and timezone."],
  EVENT_RESTART_REQUIRED: ["이전 버전의 초안입니다. 위 입력창에서 처음부터 다시 기획해 주세요.", "This draft predates conversational planning. Start a new request above."],
  EVENT_CONVERSATION_LIMIT: ["대화가 길어졌습니다. 확정된 행사 정보를 모아 새 요청으로 입력해 주세요.", "Please consolidate the confirmed details into a new request."],
  EVENT_NOTICE_INTERNAL_COMMENTARY: ["공지 품질 검수를 통과하지 못했습니다. 다시 기획해 주세요.", "The notice did not pass quality review. Try planning again."],
  EVENT_AI_NETWORK_FAILURE: ["AI 연결이 일시적으로 끊겼습니다. 다시 기획해 주세요. 폼은 생성되지 않았습니다.", "The AI connection was interrupted. Try planning again; no form was created."],
  EVENT_AI_TIMEOUT: ["AI 응답 대기 시간이 초과되었습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요. 폼은 생성되지 않았습니다.", "The AI response timed out. Your input is preserved. Try again shortly; no form was created."],
  CLUB_ADMIN_REQUIRED: ["해당 클럽의 관리자 권한이 필요합니다.", "Administrator access for this club is required."],
  EVENT_STUDIO_UNAVAILABLE: ["Event Studio 연결을 확인해주세요. 기존 신청 기능은 계속 사용할 수 있습니다.", "Check the Event Studio connection. Existing applications remain available."],
};
export function EventStudio({ initialClub, initialPreview, onComplete, embedded = false, archiveIds = [] }: { initialClub?: StudioClub; initialPreview?: StudioPreview | null; onComplete?: () => void; embedded?: boolean; archiveIds?: string[] }) {
  const { language } = useLanguage(); const ko = language === "ko";
  const t = (kr: string, en: string) => ko ? kr : en;
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState(""), [result, setResult] = useState<StudioPreview | null>(null), [plan, setPlan] = useState<EventPlan | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [applicants, setApplicants] = useState<{ id: string; name: string }[] | null>(null);
  const [applicantTotal, setApplicantTotal] = useState(0);
  async function load() {
    const next = await studioCommand<Config>({ action: "list" }); setConfig(next);
  }
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  useEffect(() => { setResult(null); setPlan(null); }, [initialClub]);
  useEffect(() => {
    let active = true;
    if (!initialClub || initialClub === "personal") void studioCommand<{ connected: boolean }>({ action: "connection" }).then(status => { if (active) setConnected(status.connected); }).catch(() => { if (active) setConnected(false); });
    return () => { active = false; };
  }, [initialClub]);
  useEffect(() => { if (initialPreview) select(initialPreview); }, [initialPreview]);
  function select(next: StudioPreview) { setResult(next); setPlan(next.job.plan); setDirty(false); setAnswer(""); setApplicants(null); }
  function edit(update: Partial<EventPlan>) { if (plan) { setPlan({ ...plan, ...update }); setDirty(true); } }
  async function run(action: string) {
    if (busy) return; setBusy(true); setError("");
    try {
      const next = await studioCommand<StudioPreview>({ action, ...(initialClub ? { clubKey: initialClub } : {}), message: action === "refine" ? answer : message, archiveIds, jobId: result?.job.id, revision: result?.job.revision,
        ...(action === "update" ? { plan } : {}), ...(action === "approve" ? { confirmed: true, token: result?.token } : {}) });
      select(next); await load(); if (action === "approve") onComplete?.();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visibleJobs = config?.jobs.filter(j => !initialClub || j.club_key === initialClub) || [];
  const readOnly = Boolean(config?.access.readOnly);
  const personal = (plan?.clubKey || initialClub || "personal") === "personal";
  return <section className={embedded ? "mt-7 min-w-0 space-y-5 text-ink" : "mx-auto w-full max-w-5xl space-y-5 px-4 py-5 text-ink sm:px-6"}>
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
      {embedded ? <h2 className="flex items-center gap-2 text-xl font-semibold"><Glasses aria-hidden className="h-6 w-6 shrink-0" />{t("우혁몬", "WOOHYUKMON")}</h2> : <h2 className="text-lg font-semibold">{t("행사 만들기", "Create an event")}</h2>}
      <div className="flex items-center gap-2">
        {personal && !readOnly && (connected ? <span className="inline-flex items-center gap-1 text-sm text-emerald-800"><Check aria-hidden className="h-4 w-4" />{t("Google 연결됨", "Google connected")}</span> : <a className="inline-flex min-h-11 items-center border border-ink/20 px-3 text-sm" href="/api/google-forms/oauth/start?mode=personal">{t("내 Google 연결", "Connect my Google")}</a>)}
        <button type="button" title={t("행사 목록 새로고침", "Refresh events")} aria-label={t("행사 목록 새로고침", "Refresh events")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-ink/5 disabled:opacity-40" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}><RefreshCw aria-hidden className="h-4 w-4" /></button>
      </div>
    </div>
    {!config?.aiEnabled && config && <p role="status" className="text-sm text-ink/65">{t("행사 전용 AI 연결을 준비 중입니다. 저장된 초안은 계속 확인할 수 있습니다.", "Event AI is not enabled yet. Saved drafts remain accessible.")}</p>}
    {!readOnly && <form onSubmit={e => { e.preventDefault(); void run("plan"); }} className="flex items-end gap-2 rounded-lg border border-ink/20 bg-white/70 p-2 focus-within:ring-2 focus-within:ring-brass/40">
      <textarea aria-label={t("행사 계획", "Event request")} disabled={busy} className="min-h-28 min-w-0 flex-1 resize-y bg-transparent p-3 text-base outline-none" placeholder={t("어떤 행사를 만들까요?", "What event would you like to create?")} value={message} onChange={e => setMessage(e.target.value)} />
      <button aria-label={t("행사 기획", "Plan event")} title={t("행사 기획", "Plan event")} disabled={busy || !message.trim() || !config?.aiEnabled} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink text-paper transition-opacity disabled:opacity-30"><ArrowUp aria-hidden className="h-5 w-5" /></button>
    </form>}
    {busy && <p role="status" className="text-sm">{t("작업을 확인하고 있습니다. 잠시 기다려주세요.", "Checking this step. Please wait.")}</p>}
    {error && <p role="alert" className="break-words text-sm text-red-700">{errors[error]?.[ko ? 0 : 1] || t("처리하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해주세요.", "Could not complete this step. Your input is preserved. Please retry shortly.")}</p>}
    {visibleJobs.length > 0 && <div className="grid gap-2"><label className="text-sm font-semibold" htmlFor="studio-drafts">{t("저장된 행사", "Saved events")}</label><select id="studio-drafts" className="form-field" value={result?.job.id || ""} disabled={busy} onChange={e => { if (e.target.value) { setBusy(true); void studioCommand<StudioPreview>({ action: "get", jobId: e.target.value }).then(select).catch(e => setError(e.message)).finally(() => setBusy(false)); } }}><option value="">{t("선택", "Select")}</option>{visibleJobs.map(job => <option key={job.id} value={job.id}>{job.plan.title}</option>)}</select></div>}
    {result && plan && <div className="space-y-4 border-t border-ink/15 pt-5">
      {result.archiveLinkPending && <p role="status" className="text-sm text-ink/65">{t("행사 초안은 저장되었습니다. 참고 자료 연결은 다시 확인해야 합니다.", "The event draft is saved. Its archive links need reconciliation.")}</p>}
      {!result.creationSupported && <p role="status" className="text-sm">{t("이 클럽은 기획·공지 초안까지 지원합니다. 행사·공지 저장 연결은 준비 중이며 Google Form을 실행하지 않습니다.", "Planning and notice drafts are supported. The club storage adapter is not ready; Google Forms creation is disabled.")}</p>}
      {result.job.state === "notice_saved" && result.form ? <>
        <h2 className="text-xl font-semibold">{plan.title}</h2>
        <p role="status" className="text-sm">{t("폼과 공지 초안이 저장되었습니다. 모집은 아직 시작되지 않았습니다.", "The form and private notice draft are saved. Recruitment has not started.")}</p>
        <div className="flex flex-wrap gap-2"><a className="inline-flex min-h-11 items-center border border-ink/20 px-4 text-sm" href={result.form.edit_url} target="_blank" rel="noopener noreferrer">{t("구글폼 원본 보기", "Open original Google Form")}</a>
          {!readOnly && !personal && result.job.form_registry_id && <EventDeleteButton formId={result.job.form_registry_id} title={plan.title} disabled={busy} onError={setError} onDeleted={async () => {
            setResult(null); setPlan(null); setDirty(false); await load(); onComplete?.();
          }} />}
        </div>
        <button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm disabled:opacity-40" onClick={async () => {
          setBusy(true); setError("");
          try { const response = await studioCommand<{ applicants: { id: string; name: string }[]; total: number }>({ action: "responses", jobId: result.job.id }); setApplicants(response.applicants); setApplicantTotal(response.total); }
          catch (e) { setError((e as Error).message); } finally { setBusy(false); }
        }}><Users aria-hidden className="h-4 w-4" />{t("응답자 확인", "View applicants")}</button>
        {applicants && <section aria-label={t("응답자", "Applicants")} className="space-y-2 border-t border-ink/10 pt-3"><h3 className="text-sm font-semibold">{t(`응답자 ${applicantTotal}명`, `${applicantTotal} applicants`)}</h3>{applicantTotal > applicants.length && <p className="text-xs text-muted">{t(`1–${applicants.length} / ${applicantTotal}명`, `1–${applicants.length} of ${applicantTotal}`)}</p>}{applicants.length ? <ul className="space-y-2 text-sm">{applicants.map(applicant => <li key={applicant.id}>{applicant.name}</li>)}</ul> : <p className="text-sm text-muted">{t("아직 응답이 없습니다.", "No responses yet.")}</p>}</section>}
        <ActivityNoticeOutput notice={result.notice || ""} applicationUrl={result.applicationUrl || ""} onError={setError} />
      </> : <>
        <div className="space-y-3">
          {result.missing.length > 0 && <p role="status" className="whitespace-pre-line text-sm leading-relaxed">{(result.clarification || eventClarification(result.missing, plan.title))[ko ? "ko" : "en"]}</p>}
          {!readOnly && result.job.state === "draft" && <details open={result.missing.length > 0} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm text-ink/70 [&::-webkit-details-marker]:hidden">{t("추가로 알려주기", "Add more details")}<ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
            <form className="flex items-end gap-2 rounded-lg border border-ink/20 bg-white/70 p-2 focus-within:ring-2 focus-within:ring-brass/40" onSubmit={event => { event.preventDefault(); void run("refine"); }}>
            <textarea aria-label={t("추가 답변", "Additional details")} className="min-h-24 min-w-0 flex-1 resize-y bg-transparent p-3 text-base outline-none" disabled={busy || dirty} value={answer} onChange={event => setAnswer(event.target.value)} />
            <button aria-label={t("답변 반영", "Apply details")} title={t("답변 반영", "Apply details")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink text-paper disabled:opacity-30" disabled={busy || dirty || !answer.trim()}><ArrowUp aria-hidden className="h-5 w-5" /></button>
          </form></details>}
        </div>
        <details open={!result.missing.length} className="group">
        <summary className="mb-4 flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">{t("신청폼 · 공지 검토", "Review form and notice")}<ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
        <fieldset disabled={readOnly || busy || result.job.state !== "draft"} className="min-w-0 space-y-4 disabled:opacity-70">
          <label className="grid gap-2 text-sm">{t("제목", "Title")}<input className="form-field" value={plan.title} onChange={e => edit({ title: e.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">{(["descriptionKo", "descriptionEn"] as const).map(key => <label className="grid gap-2 text-sm" key={key}>{key === "descriptionKo" ? t("한국어 소개", "Korean introduction") : t("영어 소개", "English introduction")}<textarea className="form-field min-h-24" value={plan[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">{(["activityDate", "applicationDeadline", "location", "capacity"] as const).map(key => <label className="grid gap-2 text-sm" key={key}>{({ activityDate: t("행사 일시 (ISO)", "Event date (ISO)"), applicationDeadline: t("신청 마감 (ISO)", "Deadline (ISO)"), location: t("장소", "Venue"), capacity: t("정원", "Capacity") })[key]}<input type={key === "capacity" ? "number" : "text"} min={key === "capacity" ? 1 : undefined} className="form-field" value={plan[key] ?? ""} onChange={e => edit({ [key]: key === "capacity" ? e.target.value ? Number(e.target.value) : null : e.target.value || null })} /></label>)}</div>
          <ol className="space-y-4">{plan.questions.map((q, index) => <li key={q.id} className="space-y-2 border-b border-ink/10 pb-3">
            <input aria-label={t(`질문 ${index + 1}`, `Question ${index + 1}`)} className="form-field" value={q.title} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, title: e.target.value } : item) })} />
            <div className="flex flex-wrap items-center gap-2"><select aria-label={t("질문 유형", "Question type")} className="form-field w-auto max-w-full" value={q.type} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, type: e.target.value as typeof q.type, options: ["multiple_choice", "checkbox", "dropdown"].includes(e.target.value) ? item.options : [] } : item) })}>{Object.entries(questionLabels).map(([type, labels]) => <option key={type} value={type}>{labels[ko ? 0 : 1]}</option>)}</select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={q.required} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, required: e.target.checked } : item) })} />{t("필수", "Required")}</label>
              {[-1, 1].map(offset => <button type="button" key={offset} aria-label={offset < 0 ? t("질문 위로", "Move up") : t("질문 아래로", "Move down")} title={offset < 0 ? t("질문 위로", "Move up") : t("질문 아래로", "Move down")} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-ink/5 disabled:opacity-30" disabled={index + offset < 0 || index + offset >= plan.questions.length} onClick={() => { const questions = [...plan.questions]; [questions[index], questions[index + offset]] = [questions[index + offset], questions[index]]; edit({ questions }); }}>{offset < 0 ? <ChevronUp aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4" />}</button>)}
              <button type="button" aria-label={t("질문 삭제", "Delete question")} title={t("질문 삭제", "Delete question")} className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-ink/5" onClick={() => edit({ questions: plan.questions.filter(item => item.id !== q.id) })}><Trash2 aria-hidden className="h-4 w-4" /></button>
            </div>
            {["multiple_choice", "checkbox", "dropdown"].includes(q.type) && <textarea aria-label={t("선택지", "Choices")} className="form-field min-h-24" value={q.options.join("\n")} onChange={e => edit({ questions: plan.questions.map(item => item.id === q.id ? { ...item, options: e.target.value.split("\n") } : item) })} />}
          </li>)}</ol>
          <button type="button" className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm" onClick={() => edit({ questions: [...plan.questions, { id: crypto.randomUUID(), title: "", type: "short_answer", required: false, options: [] }] })}><Plus className="h-4 w-4" />{t("질문 추가", "Add question")}</button>
          {(["noticeKo", "noticeEn"] as const).map(key => <label key={key} className="grid gap-2 text-sm">{key === "noticeKo" ? t("한국어 공지", "Korean notice") : t("영어 공지", "English notice")}<textarea aria-label={key === "noticeKo" ? t("한국어 공지", "Korean notice") : t("영어 공지", "English notice")} className="form-field min-h-48" value={plan[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}
        </fieldset>
        </details>
        {!readOnly && <div className="flex flex-wrap gap-2">
          <button disabled={busy || !dirty} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm disabled:opacity-40" onClick={() => void run("update")}><Save className="h-4 w-4" />{t("초안 저장", "Save draft")}</button>
          <button disabled={busy || dirty || !result.creationSupported || result.missing.length > 0} className="min-h-11 border border-ink/20 px-4 text-sm disabled:opacity-40" onClick={() => void run(result.job.state === "running" ? "recover" : "review")}>{t("승인 새로 확인", "Renew approval")}</button>
          <button disabled={busy || dirty || !result.token || result.job.state === "running" || personal && !connected} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-paper disabled:opacity-40" onClick={() => void run("approve")}><Check className="h-4 w-4" />{t("승인 · 비공개 폼 생성", "Approve private form creation")}</button>
        </div>}
      </>}
    </div>}
  </section>;
}
