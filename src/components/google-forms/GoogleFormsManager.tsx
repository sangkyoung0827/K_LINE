"use client";

import { ArrowLeft, Copy, ExternalLink, FilePlus2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GoogleFormsAccess } from "@/lib/googleForms/access";
import type { GoogleFormTemplate } from "@/lib/googleForms/templates";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { WoohyukmonFormsAssistant, type WorkflowPreview } from "./WoohyukmonFormsAssistant";
import { applicantNames, googleTeamNotice } from "@/lib/googleForms/applicants";
import { ActivityNoticeOutput } from "./ActivityNoticeOutput";

type Props = { initialAccess: GoogleFormsAccess; templates: GoogleFormTemplate[] };
type ListResponse = { access: GoogleFormsAccess; connection: { connected: boolean; accountEmail: string }; forms: GoogleFormRegistryRow[]; error?: string };
type MirrorResponse = { responses: Array<{ id: string; submitted_at: string; respondent_email: string | null; answers_json: Record<string, string[]> }>; error?: string };

export function GoogleFormsManager({ initialAccess, templates }: Props) {
  const [section, setSection] = useState("assistant");
  const [preview, setPreview] = useState<{ workflow: WorkflowPreview; token: string } | null>(null);
  const [data, setData] = useState<ListResponse>({ access: initialAccess, connection: { connected: false, accountEmail: "" }, forms: [] });
  const [clubKey, setClubKey] = useState(initialAccess.manageableClubs[0]);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");
  const [createdForm, setCreatedForm] = useState<GoogleFormRegistryRow | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [selected, setSelected] = useState<string | null>(null); const [mirror, setMirror] = useState<MirrorResponse | null>(null);
  const [teamSize, setTeamSize] = useState(4);
  const [teamText, setTeamText] = useState("");
  const forms = useMemo(() => data.forms.filter((form) => form.club_key === clubKey), [clubKey, data.forms]);
  async function load() { const response = await fetch("/api/google-forms/forms", { cache: "no-store" }); const next = await response.json() as ListResponse; if (!response.ok) throw new Error(next.error || "Google Forms could not load."); setData(next); }
  useEffect(() => { void load().catch((error) => setMessage((error as Error).message)); }, []);
  function resetCreation() { setPreview(null); setNotice(""); setApplicationUrl(""); setCreatedForm(null); setMessage(""); }
  async function create() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      let pending = preview;
      if (!pending) {
        const response = await fetch("/api/google-forms/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetOnly: true, clubKey, templateId, title }) });
        const result = await response.json();
        if (!response.ok || !result.token) throw new Error(result.error || "신청폼 초안을 만들지 못했습니다.");
        pending = result as { workflow: WorkflowPreview; token: string };
        setPreview(pending);
      }
      const response = await fetch("/api/woohyukmon/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm_google_forms", token: pending.token }) });
      const result = await response.json();
      if (!response.ok || !result.form?.responder_url || !result.notice) throw new Error(result.error || "Google Forms 생성 확인에 실패했습니다.");
      setCreatedForm(result.form); setNotice(result.notice); setApplicationUrl(result.applicationUrl || result.form.responder_url);
      setMessage("신청폼과 공지 초안이 생성되었습니다.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Forms 연결에 문제가 있습니다.");
    } finally { setBusy(false); }
  }
  async function responses(form: GoogleFormRegistryRow) {
    if (busy) return;
    setSelected(form.id); setMirror(null); setTeamText(""); setMessage(""); setBusy(true);
    try {
      if (!initialAccess.isReadOnly) {
        const syncResponse = await fetch(`/api/google-forms/forms/${form.id}/responses`, { method: "POST" });
        const result = await syncResponse.json() as { error?: string };
        if (!syncResponse.ok) throw new Error(result.error || "응답 동기화에 실패했습니다.");
        await load();
      }
      const response = await fetch(`/api/google-forms/forms/${form.id}/responses`, { cache: "no-store" });
      const next = await response.json() as MirrorResponse;
      if (!response.ok) throw new Error(next.error || "신청자 명단을 불러오지 못했습니다.");
      setMirror(next);
      const size = Number.isInteger(teamSize) && teamSize >= 1 && teamSize <= 50 ? teamSize : 4;
      setTeamSize(size);
      setTeamText(googleTeamNotice(form.title, next.responses, size));
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="bg-paper py-10 sm:py-16"><div className="mx-auto max-w-7xl px-5 md:px-8">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold underline"><ArrowLeft className="h-4 w-4" />K_LINE</Link>
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase text-brass">Google Forms · Test</p><h1 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">Application management</h1></div>{initialAccess.canConnect ? <a href="/api/google-forms/oauth/start" className="inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-paper">{data.connection.connected ? `Reconnect ${data.connection.accountEmail}` : "Connect test Google account"}</a> : null}</div>
    <div role="tablist" aria-label="Forms management" className="mt-6 flex flex-wrap gap-2">{[["assistant", "우혁몬 5.0"], ["forms", "Google Forms"], ["applicants", "신청자 관리"]].map(([id, label]) => <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={`min-h-11 px-4 text-sm font-semibold ${section === id ? "bg-ink text-paper" : "border border-ink/20"}`}>{label}</button>)}</div>
    {section === "assistant" && !initialAccess.isReadOnly ? <WoohyukmonFormsAssistant /> : null}
    {message ? <p role="status" className="mt-5 border border-brass/30 bg-brass/10 p-3 text-sm font-semibold text-ink">{message}</p> : null}
    <div className="mt-8 flex gap-2 overflow-x-auto">{initialAccess.manageableClubs.map((club) => <button key={club} disabled={busy} onClick={() => { setClubKey(club); resetCreation(); }} className={`min-h-10 whitespace-nowrap px-4 text-sm font-semibold ${clubKey === club ? "bg-navy text-paper" : "border border-ink/15"}`}>{club}</button>)}</div>
    {!initialAccess.isReadOnly && section === "forms" ? <div className="mt-6 border-t border-ink/12 pt-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><FilePlus2 className="h-6 w-6" />Create Google Form</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Template"><select aria-label="Template" disabled={busy} value={templateId} onChange={(event) => { setTemplateId(event.target.value); resetCreation(); }} className="form-field">{templates.filter((template) => template.questions.length).map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></Field>
        <Field label="활동 제목"><input aria-label="활동 제목" disabled={busy} className="form-field" value={title} placeholder="활동 제목" onChange={(event) => { setTitle(event.target.value); resetCreation(); }} /></Field>
      </div>
      <button disabled={busy || !title.trim() || !!createdForm} onClick={() => void create()} className="mt-4 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-45"><FilePlus2 className="h-4 w-4" />{busy ? "생성 중..." : createdForm ? "생성 완료" : preview ? "생성 다시 시도" : "신청폼 · 공지 생성"}</button>
      {notice && createdForm ? <div className="mt-6 border-t border-ink/12 pt-5">
        <ActivityNoticeOutput notice={notice} applicationUrl={applicationUrl} onError={setMessage} />
        <a href={`https://docs.google.com/forms/d/${encodeURIComponent(createdForm.google_form_id)}/edit`} className="mt-3 inline-flex min-h-11 items-center gap-2 underline">구글폼 원본 보기<ExternalLink className="h-4 w-4" /></a>
      </div> : null}
    </div> : null}
    <div className={section === "assistant" ? "hidden" : "mt-8 grid gap-4"}>{forms.map((form) => <article key={form.id} className="border border-ink/12 bg-white/60 p-4 sm:p-5">
      <p className="text-xs font-bold uppercase text-brass">{form.status} · Google Forms</p>
      <h2 className="mt-1 break-words text-xl font-bold text-ink">{form.title}</h2>
      <p className="mt-2 text-sm text-ink/60">신청자 {form.response_count}명</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`https://docs.google.com/forms/d/${encodeURIComponent(form.google_form_id)}/edit`} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm font-semibold">구글폼 원본 보기<ExternalLink className="h-4 w-4 shrink-0" /></a>
        <button disabled={busy} onClick={() => void responses(form)} className="inline-flex min-h-11 items-center gap-2 bg-navy px-3 text-sm font-semibold text-paper disabled:opacity-45"><Users className="h-4 w-4 shrink-0" />{busy && selected === form.id ? "불러오는 중..." : "조 자동 편성 및 공지문 생성"}</button>
      </div>
    </article>)}{!forms.length ? <p className="border border-dashed border-ink/20 p-8 text-center text-sm text-ink/55">No Google Form is registered for this club.</p> : null}</div>
    {selected && mirror ? <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/55 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="google-applicants-title" className="mx-auto max-w-5xl bg-paper p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 id="google-applicants-title" className="text-xl font-semibold">조 편성 · 공지문</h2>
          <button className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={() => { setSelected(null); setMirror(null); setTeamText(""); }} aria-label="Close"><X className="h-6 w-6" /></button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">한 조 인원<input aria-label="Team size" type="number" min="1" max="50" className="form-field w-24" value={teamSize} onChange={(e) => { setTeamSize(Number(e.target.value)); setTeamText(""); }} /></label>
          <button disabled={!mirror.responses.length || !Number.isInteger(teamSize) || teamSize < 1 || teamSize > 50} className="min-h-11 border border-ink/20 px-3 text-sm disabled:opacity-40" onClick={() => setTeamText(googleTeamNotice(forms.find((form) => form.id === selected)?.title || "", mirror.responses, teamSize))}>다시 편성</button>
          <button disabled={!mirror.responses.length} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm disabled:opacity-40" onClick={() => void navigator.clipboard.writeText(applicantNames(mirror.responses).join("\n")).catch(() => setMessage("Clipboard unavailable"))}><Copy className="h-4 w-4" />명단 복사</button>
        </div>
        {teamText ? <div className="mt-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">공지문</h3><button title="공지문 복사" aria-label="공지문 복사" className="flex h-11 w-11 shrink-0 items-center justify-center border border-ink/20" onClick={() => void navigator.clipboard.writeText(teamText).catch(() => setMessage("공지문 복사에 실패했습니다."))}><Copy className="h-4 w-4" /></button></div>
          <textarea aria-label="조 편성 공지문" className="form-field mt-2 min-h-48" value={teamText} onChange={(e) => setTeamText(e.target.value)} />
        </div> : null}
        <ul aria-label="신청자 이름" className="mt-5 divide-y divide-ink/10">
          {applicantNames(mirror.responses).map((name, index) => <li key={mirror.responses[index].id} className="break-words py-3 text-sm font-semibold">{name}</li>)}
        </ul>
        {!mirror.responses.length ? <p className="py-8 text-center text-sm text-ink/55">신청자가 없습니다.</p> : null}
      </div>
    </div> : null}
  </div></section>;
}

function Field({ children, label, wide = false }: { children: React.ReactNode; label: string; wide?: boolean }) { return <label className={`grid gap-1 text-sm font-semibold ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}><span>{label}</span>{children}</label>; }
