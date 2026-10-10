"use client";

import { ArrowLeft, Copy, ExternalLink, FilePlus2, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GoogleFormsAccess } from "@/lib/googleForms/access";
import type { GoogleFormTemplate } from "@/lib/googleForms/templates";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";
import type { WorkflowPreview } from "./WoohyukmonFormsAssistant";
import { EventStudio } from "./EventStudio";
import { applicantNames, googleTeamNotice } from "@/lib/googleForms/applicants";
import { ActivityNoticeOutput } from "./ActivityNoticeOutput";
import { useLanguage } from "@/components/LanguageProvider";

type Props = { initialAccess: GoogleFormsAccess; templates: GoogleFormTemplate[]; production?: boolean; app?: boolean; draftOnly?: boolean };
type ListResponse = { access: GoogleFormsAccess; connection: { connected: boolean; accountEmail: string }; forms: GoogleFormRegistryRow[]; error?: string };
type MirrorResponse = { responses: Array<{ id: string; submitted_at: string; respondent_email: string | null; answers_json: Record<string, string[]> }>; error?: string };

export function GoogleFormsManager({ initialAccess, templates, production = false, app = false, draftOnly = false }: Props) {
  const { language } = useLanguage();
  const t = (ko: string, en: string) => language === "ko" ? ko : en;
  const [section, setSection] = useState("assistant");
  const [preview, setPreview] = useState<{ workflow: WorkflowPreview; token: string } | null>(null);
  const [data, setData] = useState<ListResponse>({ access: initialAccess, connection: { connected: false, accountEmail: "" }, forms: [] });
  const [clubKey, setClubKey] = useState(initialAccess.manageableClubs[0]);
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
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
    {!app && <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold underline"><ArrowLeft className="h-4 w-4" />K_LINE</Link>}
    <div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase text-brass">{production ? "ECC · Google Forms" : "Google Forms · Test"}</p><h1 className="mt-2 font-serif text-3xl font-semibold text-ink sm:text-4xl">{production ? t("행사 만들기", "Create event") : "Application management"}</h1></div>{initialAccess.canConnect ? <a href="/api/google-forms/oauth/start" className="inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-paper">{data.connection.connected ? `Reconnect ${data.connection.accountEmail}` : "Connect test Google account"}</a> : null}</div>
    <div role="tablist" aria-label={t("행사 관리", "Event management")} className="mt-6 grid grid-cols-3 gap-2 sm:flex">{[["assistant", t("우혁몬 5.0", "WOOHYUKMON 5.0")], ["forms", "Google Forms"], ["applicants", t("신청자 관리", "Applicants")]].map(([id, label], index) => <button key={id} id={`event-tab-${id}`} role="tab" tabIndex={section === id ? 0 : -1} aria-selected={section === id} aria-controls={`event-panel-${id}`} onKeyDown={event => {
      const ids = ["assistant", "forms", "applicants"];
      const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
      if (next === null) return;
      event.preventDefault(); setSection(ids[next]);
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#event-tab-${ids[next]}`)?.focus();
    }} onClick={() => setSection(id)} className={`min-h-11 min-w-0 break-words px-2 py-2 text-xs font-semibold sm:px-4 sm:text-sm ${section === id ? "bg-ink text-paper" : "border border-ink/20"}`}>{label}</button>)}</div>
    {!initialAccess.isReadOnly ? <div id="event-panel-assistant" role="tabpanel" aria-labelledby="event-tab-assistant" hidden={section !== "assistant"}><EventStudio embedded initialClub={clubKey === "social_impact_union" ? clubKey : "ecc"} onComplete={() => { void load().catch(error => setMessage((error as Error).message)); }} /></div> : null}
    {message ? <p role="status" className="mt-5 border border-brass/30 bg-brass/10 p-3 text-sm font-semibold text-ink">{message}</p> : null}
    <div className="mt-8 flex gap-2 overflow-x-auto">{initialAccess.manageableClubs.map((club) => <button key={club} disabled={busy} onClick={() => { setClubKey(club); resetCreation(); }} className={`min-h-10 whitespace-nowrap px-4 text-sm font-semibold ${clubKey === club ? "bg-navy text-paper" : "border border-ink/15"}`}>{club}</button>)}</div>
    {!initialAccess.isReadOnly && section === "forms" ? <div id="event-panel-forms" role="tabpanel" aria-labelledby="event-tab-forms" className="mt-6 border-t border-ink/12 pt-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><FilePlus2 className="h-6 w-6" />Create Google Form</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Template"><select aria-label="Template" disabled={busy} value={templateId} onChange={(event) => { setTemplateId(event.target.value); resetCreation(); }} className="form-field">{templates.filter((template) => template.questions.length).map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></Field>
        <Field label="활동 제목"><input aria-label="활동 제목" disabled={busy} className="form-field" value={title} placeholder="활동 제목" onChange={(event) => { setTitle(event.target.value); resetCreation(); }} /></Field>
      </div>
      <button disabled={draftOnly || busy || !title.trim() || !templateId || !!createdForm} onClick={() => void create()} className="mt-4 inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-45"><FilePlus2 className="h-4 w-4" />{busy ? "생성 중..." : createdForm ? "생성 완료" : preview ? "생성 다시 시도" : "신청폼 · 공지 생성"}</button>
      {draftOnly && <p role="status" className="mt-3 text-sm text-ink/65">{t("이 테스트 화면은 AI 초안 생성만 가능합니다. Google Form 생성은 비활성화되어 있습니다.", "This test supports AI drafts only. Google Form creation is disabled.")}</p>}
      {notice && createdForm ? <div className="mt-6 border-t border-ink/12 pt-5">
        <ActivityNoticeOutput notice={notice} applicationUrl={applicationUrl} onError={setMessage} />
        <a href={`https://docs.google.com/forms/d/${encodeURIComponent(createdForm.google_form_id)}/edit`} className="mt-3 inline-flex min-h-11 items-center gap-2 underline">구글폼 원본 보기<ExternalLink className="h-4 w-4" /></a>
      </div> : null}
    </div> : null}
    <div id={section === "applicants" ? "event-panel-applicants" : undefined} role={section === "applicants" ? "tabpanel" : undefined} aria-labelledby={section === "applicants" ? "event-tab-applicants" : undefined} className={section === "assistant" ? "hidden" : "mt-8 grid gap-4"}>{forms.map((form) => <article key={form.id} className="border border-ink/12 bg-white/60 p-4 sm:p-5">
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
