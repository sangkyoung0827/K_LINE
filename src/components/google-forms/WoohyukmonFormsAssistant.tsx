"use client";

import { Glasses, Send, Save, Check, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import type { GoogleFormDraft } from "@/lib/googleForms/types";
import type { GoogleQuestionType } from "@/lib/googleForms/types";
import { ActivityNoticeOutput } from "./ActivityNoticeOutput";
import { noticeBody } from "@/lib/googleForms/planning";

export type WorkflowPreview = { id: string; draft: GoogleFormDraft; notice: string; workflow_status: string; revision: number; last_error?: string | null };
type Result = { workflow?: WorkflowPreview; token?: string; error?: string; summary?: string; draft?: GoogleFormDraft; notice?: string; applicationUrl?: string; form?: { edit_url?: string; responder_url: string } };
export async function formsCommand(body: object): Promise<Result> {
  const response = await fetch("/api/woohyukmon/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as Result;
  if (!response.ok) throw new Error(result.error || "작업에 실패했습니다.");
  return result;
}

export function DraftReview({ initial, onComplete, production = false }: { initial: Result; onComplete?: () => void; production?: boolean }) {
  const [result, setResult] = useState(initial);
  const [draft, setDraft] = useState(initial.workflow?.draft);
  const [notice, setNotice] = useState(noticeBody(initial.workflow?.notice || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  function updateQuestions(questions: GoogleFormDraft["questions"]) {
    if (draft) { setDraft({ ...draft, questions }); setDirty(true); }
  }
  async function run(approve: boolean) {
    if (!result.workflow || !draft) return;
    setBusy(true); setError("");
    try {
      const next = await formsCommand(approve ? { action: "confirm_google_forms", token: result.token } : {
        action: "UPDATE_GOOGLE_FORM_DRAFT", workflowId: result.workflow.id, draft, notice
      });
      setResult(next); setDirty(false);
      if (approve) onComplete?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "작업 오류"); }
    finally { setBusy(false); }
  }
  if (!draft || !result.workflow) return <p role="status" className="whitespace-pre-wrap text-sm">{result.summary}</p>;
  if (result.workflow.workflow_status === "notice_saved" && result.form) return <div className="mt-5 space-y-4 border-t border-ink/15 pt-5">
    <p role="status" className="text-sm">{result.summary}</p>
    <h3 className="text-lg font-bold">{draft.title}</h3>
    <div className="flex flex-wrap gap-3">
      {result.form.edit_url ? <a className="min-h-11 border border-ink/20 px-4 py-3 text-sm" href={result.form.edit_url}>구글폼 원본 보기</a> : null}
    </div>
    <ActivityNoticeOutput notice={result.notice || ""} applicationUrl={result.applicationUrl || result.form.responder_url} onError={setError} />
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </div>;
  return <div className="mt-5 space-y-4 border-t border-ink/15 pt-5">
    <p className="text-xs font-semibold">{result.workflow.workflow_status} · {result.workflow.id}</p>
    <label className="grid gap-2 text-sm font-semibold">제목 / Title<input className="form-field" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDirty(true); }} /></label>
    <div className="grid gap-3 sm:grid-cols-2">{(["activityDate", "applicationDeadline", "location"] as const).map((key) => <label key={key} className="grid gap-2 text-sm">{key}<input className="form-field" value={draft[key]} onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setDirty(true); }} /></label>)}</div>
    <ol className="space-y-3">{draft.questions.map((question, index) => <li key={question.id} className="grid gap-2 border-b border-ink/10 pb-3 text-sm">
      <label className="grid gap-1">질문 {index + 1}<input className="form-field" value={question.title} onChange={(e) => updateQuestions(draft.questions.map((q) => q.id === question.id ? { ...q, title: e.target.value } : q))} /></label>
      <div className="flex flex-wrap items-center gap-2"><select aria-label={`Question ${index + 1} type`} className="form-field w-auto" value={question.type} onChange={(e) => updateQuestions(draft.questions.map((q) => q.id === question.id ? { ...q, type: e.target.value as GoogleQuestionType } : q))}>{["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown", "date", "time"].map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <label className="flex items-center gap-2"><input type="checkbox" checked={question.required} onChange={(e) => updateQuestions(draft.questions.map((q) => q.id === question.id ? { ...q, required: e.target.checked } : q))} />필수</label>
      {[-1, 1].map((offset) => <button key={offset} aria-label={offset < 0 ? "Move draft question up" : "Move draft question down"} title={offset < 0 ? "Move up" : "Move down"} disabled={index + offset < 0 || index + offset >= draft.questions.length} className="flex h-11 w-11 items-center justify-center border border-ink/20 disabled:opacity-30" onClick={() => { const next = [...draft.questions]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; updateQuestions(next); }}>{offset < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</button>)}
      <button aria-label="Delete draft question" title="Delete question" className="flex h-11 w-11 items-center justify-center border border-red-700/20 text-red-700" onClick={() => updateQuestions(draft.questions.filter((q) => q.id !== question.id))}><Trash2 className="h-4 w-4" /></button></div>
      {["multiple_choice", "checkbox", "dropdown"].includes(question.type) ? <textarea aria-label={`Question ${index + 1} choices`} className="form-field min-h-24" value={question.options.join("\n")} onChange={(e) => updateQuestions(draft.questions.map((q) => q.id === question.id ? { ...q, options: e.target.value.split("\n") } : q))} /> : null}
    </li>)}</ol>
    <button className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm" onClick={() => updateQuestions([...draft.questions, { id: crypto.randomUUID(), title: "", type: "short_answer", required: false, options: [] }])}><Plus className="h-4 w-4" />질문 추가</button>
    <label className="grid gap-2 text-sm font-semibold">공지 초안 / Notice<textarea className="form-field min-h-64" value={notice} onChange={(e) => { setNotice(e.target.value); setDirty(true); }} /></label>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap gap-2"><button disabled={busy || !dirty} onClick={() => void run(false)} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm disabled:opacity-40"><Save className="h-4 w-4" />초안 변경 저장</button><button disabled={busy || dirty || !result.token || result.workflow.workflow_status === "notice_saved"} onClick={() => void run(true)} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-paper disabled:opacity-40"><Check className="h-4 w-4" />{production ? "승인 · 구글폼 생성" : "승인 · 비공개 테스트 생성"}</button></div>
  </div>;
}

export function WoohyukmonFormsAssistant({ production = false, onComplete }: { production?: boolean; onComplete?: () => void } = {}) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="mt-6 space-y-4"><h2 className="flex items-center gap-2 text-xl font-bold"><Glasses className="h-6 w-6" />우혁몬 5.0</h2>
    <form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); void formsCommand({ message }).then(setResult).catch((failure) => setError((failure as Error).message)).finally(() => setBusy(false)); }} className="flex items-end gap-2">
      <textarea aria-label="Google Forms activity command" className="form-field min-h-32 min-w-0 flex-1" value={message} onChange={(e) => setMessage(e.target.value)} />
      <button aria-label="명령 보내기" title="명령 보내기" disabled={busy || !message.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper transition hover:bg-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"><Send aria-hidden className="h-5 w-5" /></button>
    </form>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {result ? <DraftReview key={result.token || result.summary} initial={result} production={production} onComplete={onComplete} /> : null}
    {result?.draft && !result.workflow ? <div className="grid gap-3 sm:grid-cols-2">{(["title", "activityDate", "applicationDeadline", "location"] as const).map((key) => <label key={key} className="grid gap-1 text-sm">{key}<input className="form-field" value={result.draft![key]} onChange={(e) => setResult({ ...result, draft: { ...result.draft!, [key]: e.target.value } })} /></label>)}<button disabled={busy || !result.draft.title.trim()} className="min-h-11 bg-ink px-4 text-sm text-paper disabled:opacity-40" onClick={() => { setBusy(true); void formsCommand({ action: "DRAFT_GOOGLE_FORM", draft: result.draft }).then(setResult).catch((failure) => setError((failure as Error).message)).finally(() => setBusy(false)); }}>초안 저장</button></div> : null}
  </section>;
}
