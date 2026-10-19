"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Code2, Copy, Download, FileUp, FlaskConical, KeyRound, Palette, Play, Plus, RefreshCw, Save, Send, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { defaultLabAppearance, labApiPath, type LabAppearance, type LabProject, type LabRecord, type LabRecords, type LabRevision, type LabSettings, type LabState } from "@/lib/coDevelopment/model";

type Summary = Omit<LabProject, "html" | "fixture">;
type Revision = Omit<LabRevision, "html" | "fixture">;
type Detail = { project: LabProject; revisions: Revision[] };
type Editor = { title: string; description: string; html: string; fixture: string };
const empty: Editor = { title: "", description: "", html: "", fixture: "{}" };
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded border border-ink/20 px-3 text-sm font-semibold disabled:opacity-40";
const iconButton = `${button} h-11 w-11 shrink-0 p-0`;

async function command<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(labApiPath, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "LAB_UNAVAILABLE");
  return data as T;
}
function download(name: string, value: string | Blob, type = "application/json") {
  const url = URL.createObjectURL(value instanceof Blob ? value : new Blob([value], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CoDevelopmentWorkspace() {
  const { language } = useLanguage();
  const ko = language === "ko";
  const t = (kr: string, en: string) => ko ? kr : en;
  const [projects, setProjects] = useState<Summary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editor, setEditor] = useState<Editor>(empty);
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LabSettings>({ appearance: defaultLabAppearance, version: 0 });
  const [appearance, setAppearance] = useState<LabAppearance>(defaultLabAppearance);
  const [revisionId, setRevisionId] = useState("");
  const [run, setRun] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectionMode, setConnectionMode] = useState<"codex" | "gpt">("codex");
  const [token, setToken] = useState("");
  const [expiry, setExpiry] = useState("");
  const [schema, setSchema] = useState("");
  const [dirty, setDirty] = useState(false);
  const [previewStatus, setPreviewStatus] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const newId = useRef<string | null>(null);
  const previewEnabled = tab === "preview" && Boolean(revisionId);

  const errors: Record<string, string> = {
    LAB_STORAGE_UNAVAILABLE: t("공동개발실 저장소 연결을 확인해주세요.", "Check the lab storage connection."),
    LAB_UNAVAILABLE: t("공동개발실에 연결하지 못했습니다. 다시 시도해주세요.", "Could not connect. Please retry."),
    LAB_FORBIDDEN: t("공동개발자 계정으로 로그인해주세요.", "Sign in with an authorized co-developer account."),
    REVISION_CONFLICT: t("다른 변경이 저장되었습니다. 현재 입력을 내보낸 뒤 최신 버전을 불러와주세요.", "Another revision was saved. Export your edits, then load the latest version."),
    STATE_CONFLICT: t("테스트 데이터가 변경되었습니다. 다시 읽고 시도해주세요.", "Test data changed. Read it again before saving."),
    RECORD_CONFLICT: t("다른 변경이 저장되었습니다. 데이터를 다시 불러와주세요.", "Another change was saved. Reload the records."),
    SETTINGS_CONFLICT: t("공간 설정이 변경되었습니다. 최신 설정을 불러온 뒤 다시 적용해주세요.", "The workspace was customized elsewhere. Load the latest settings before applying."),
    INVALID_APPEARANCE: t("공간 설정과 색상을 확인해주세요.", "Check the workspace settings and colors."),
    CARD_TOO_LARGE: t("카드 HTML은 64KB까지 저장할 수 있습니다.", "Card HTML is limited to 64 KiB."),
    TITLE_REQUIRED: t("기능 이름을 입력해주세요.", "Enter a feature name."),
    HTML_REQUIRED: t("HTML 코드를 입력하거나 파일을 올려주세요.", "Enter HTML or import a file."),
    RATE_LIMITED: t("잠시 후 다시 시도해주세요.", "Please try again shortly."),
    DATA_MUST_BE_OBJECT: t("테스트 데이터는 JSON 객체여야 합니다.", "Test data must be a JSON object."),
    DATA_TOO_LARGE: t("테스트 데이터는 64KB까지 저장할 수 있습니다.", "Test data is limited to 64 KiB."),
    HTML_TOO_LARGE: t("HTML은 256KB까지 저장할 수 있습니다.", "HTML is limited to 256 KiB."),
    INVALID_FILE: t("HTML 또는 공동개발실 JSON 파일을 선택해주세요.", "Choose an HTML or lab JSON file.")
  };
  function errorText(value: unknown) {
    const code = value instanceof Error ? value.message : "";
    return errors[code] || t("처리하지 못했습니다. 입력을 확인하고 다시 시도해주세요.", "Could not complete the action. Check the input and retry.");
  }
  async function perform(action: () => Promise<void>) {
    setError(""); setNotice(""); setBusy(true);
    try { await action(); } catch (value) { setError(errorText(value)); } finally { setBusy(false); }
  }
  const refresh = useCallback(async () => {
    const data = await command<{ projects: Summary[] }>({ action: "list" }); setProjects(data.projects);
  }, []);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const [configuration, data] = await Promise.all([
        command<LabSettings>({ action: "settings_get" }), command<{ projects: Summary[] }>({ action: "list" })
      ]);
      if (disposed) return;
      setSettings(configuration); setAppearance(configuration.appearance); setProjects(data.projects);
      const id = configuration.appearance.landingProjectId || data.projects[0]?.id;
      if (id) {
        const value = await command<Detail>({ action: "get", id });
        if (disposed) return;
        setDetail(value); setEditor({ title: value.project.title, description: value.project.description, html: value.project.html, fixture: JSON.stringify(value.project.fixture, null, 2) });
        setRevisionId(value.revisions[0]?.id || "");
      }
    })().catch(() => { if (!disposed) setError("공동개발실 저장소 연결을 확인해주세요. / Check the lab storage connection."); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!connecting) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setConnecting(false); setToken(""); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, summary, a[href], textarea') || []);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keys); previous?.focus(); };
  }, [connecting]);

  useEffect(() => {
    if (!previewEnabled) return;
    let port: MessagePort | null = null;
    let disposed = false;
    let queue = Promise.resolve(); let requests = 0; let windowStart = Date.now();
    setPreviewStatus(ko ? "연결 중" : "Connecting");
    const timeout = setTimeout(() => setPreviewStatus(ko ? "연결을 확인하고 다시 실행해주세요." : "Check the connection and restart."), 12000);
    const onReady = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== "kline-lab-ready") return;
      clearTimeout(timeout);
      port?.close();
      const channel = new MessageChannel(); port = channel.port1;
      const activePort = port;
      port.onmessage = message => {
        const input = message.data;
        if (!input || !Number.isSafeInteger(input.id)) return;
        queue = queue.then(async () => {
          if (disposed || port !== activePort) return;
          try {
            if (Date.now() - windowStart > 60000) { requests = 0; windowStart = Date.now(); }
            if (++requests > 60) throw new Error("RATE_LIMITED");
            let result: LabState | LabRecord | LabRecords;
            if (input.action === "read") result = await command<LabState>({ action: "state_read", revisionId });
            else if (input.action === "save") result = await command<LabState>({ action: "state_save", revisionId, data: input.data, expectedVersion: input.expectedVersion });
            else if (input.action === "records_list") result = await command<LabRecords>({ action: "records_list", projectId: detail?.project.id, collection: input.collection, after: input.after, limit: input.limit, includeArchived: input.includeArchived });
            else if (input.action === "record_create") result = await command<LabRecord>({ action: "record_save", projectId: detail?.project.id, collection: input.collection, id: crypto.randomUUID(), data: input.data, expectedVersion: 0 });
            else if (input.action === "record_save") result = await command<LabRecord>({ action: "record_save", projectId: detail?.project.id, collection: input.collection, id: input.recordId, data: input.data, expectedVersion: input.expectedVersion, archived: input.archived });
            else throw new Error("INVALID_OPERATION");
            if (!disposed) activePort.postMessage({ id: input.id, result });
          } catch (value) {
            if (!disposed) activePort.postMessage({ id: input.id, error: value instanceof Error ? value.message : "LAB_UNAVAILABLE" });
          }
        });
      };
      event.source?.postMessage({ type: "kline-lab-connect" }, { targetOrigin: "*", transfer: [channel.port2] });
      setPreviewStatus(ko ? "실행 중" : "Running");
    };
    window.addEventListener("message", onReady);
    return () => { disposed = true; clearTimeout(timeout); window.removeEventListener("message", onReady); port?.close(); };
  }, [previewEnabled, revisionId, run, ko, detail?.project.id]);

  function canLeave() { return !dirty || window.confirm(t("저장하지 않은 입력을 닫을까요?", "Discard unsaved edits?")); }
  function applyDetail(value: Detail) {
    setDetail(value); setEditor({ title: value.project.title, description: value.project.description, html: value.project.html, fixture: JSON.stringify(value.project.fixture, null, 2) });
    setRevisionId(value.revisions[0]?.id || ""); setDirty(false); newId.current = null; setRun(current => current + 1);
  }
  async function load(id: string) { applyDetail(await command<Detail>({ action: "get", id })); }
  async function save() {
    let fixture: unknown;
    try { fixture = JSON.parse(editor.fixture); } catch { throw new Error("DATA_MUST_BE_OBJECT"); }
    if (!newId.current) newId.current = crypto.randomUUID();
    const result = await command<{ project: LabProject }>({ action: "save", id: detail?.project.id || newId.current, expectedRevision: detail?.project.revision || 0, ...editor, fixture });
    await load(result.project.id); await refresh(); setTab("preview"); setNotice(t("저장했습니다.", "Saved."));
  }
  async function importFile(file: File) {
    if (file.size > 400000) throw new Error("HTML_TOO_LARGE");
    const text = await file.text();
    if (/\.html?$/i.test(file.name)) setEditor(current => ({ ...current, title: current.title || file.name.replace(/\.html?$/i, ""), html: text }));
    else if (/\.json$/i.test(file.name)) {
      let value; try { value = JSON.parse(text); } catch { throw new Error("INVALID_FILE"); }
      if (typeof value.html !== "string" || typeof value.title !== "string" || !value.fixture || typeof value.fixture !== "object" || Array.isArray(value.fixture)) throw new Error("INVALID_FILE");
      setEditor({ title: value.title, description: typeof value.description === "string" ? value.description : "", html: value.html, fixture: JSON.stringify(value.fixture, null, 2) });
    } else throw new Error("INVALID_FILE");
    setDirty(true); setTab("source");
  }
  async function copy(value: string) { await navigator.clipboard.writeText(value); setNotice(t("복사했습니다.", "Copied.")); }
  function update(key: keyof Editor, value: string) { setEditor(current => ({ ...current, [key]: value })); setDirty(true); }
  async function saveAppearance() {
    const value = await command<LabSettings>({ action: "settings_save", expectedVersion: settings.version, appearance });
    setSettings(value); setAppearance(value.appearance); setCustomizing(false);
    const target = value.appearance.landingProjectId || projects[0]?.id;
    if (target) { await load(target); setTab("preview"); }
    setNotice(t("공동개발실에 적용했습니다.", "Applied to the private lab."));
  }
  async function reloadResult() {
    if (!canLeave()) return;
    await perform(async () => {
      await refresh();
      const value = await command<LabSettings>({ action: "settings_get" }); setSettings(value);
      if (!customizing) setAppearance(value.appearance);
      if (detail) await load(detail.project.id);
    });
  }

  return <main className="min-h-[80dvh] px-4 py-6 sm:px-6" style={{ background: settings.appearance.background, color: settings.appearance.foreground }}>
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/15 pb-5">
        <div className="min-w-0"><Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />K_LINE</Link><h1 className="flex items-center gap-3 break-words text-2xl font-semibold [overflow-wrap:anywhere]"><FlaskConical className="shrink-0" size={26} style={{ color: settings.appearance.accent }} />{settings.appearance.title}</h1></div>
        <div className="flex flex-wrap gap-2"><button type="button" aria-expanded={toolsOpen} onClick={() => { if (canLeave()) { setToolsOpen(value => !value); setTab("preview"); } }} className={button}><Code2 size={16} />{t("개발 도구", "Developer tools")}</button><button type="button" className={iconButton} aria-label={t("공간 꾸미기", "Customize workspace")} title={t("공간 꾸미기", "Customize workspace")} aria-expanded={customizing} disabled={loading || busy} onClick={() => setCustomizing(value => !value)}><Palette size={17} /></button><button type="button" onClick={() => { setConnecting(true); setError(""); }} className={button}><KeyRound size={16} />{t("Codex 연결", "Connect Codex")}</button></div>
      </header>
      {error && <p role="alert" className="border-l-4 border-red-700 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 text-sm text-emerald-900"><Check size={16} />{notice}</p>}
      {customizing && <section aria-label={t("공간 꾸미기", "Customize workspace")} className="space-y-4 border-b border-ink/15 bg-white p-4 text-ink">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">{t("카드 · 공간 이름", "Card / workspace name")}<input className="form-field" maxLength={120} value={appearance.title} onChange={event => setAppearance(current => ({ ...current, title: event.target.value }))} /></label><label className="grid gap-2 text-sm">{t("첫 화면", "Opening screen")}<select className="form-field" value={appearance.landingProjectId || ""} onChange={event => setAppearance(current => ({ ...current, landingProjectId: event.target.value || null }))}><option value="">{t("최근 작업", "Latest work")}</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></div>
        <label className="grid gap-2 text-sm">{t("카드 설명", "Card description")}<textarea className="form-field" rows={2} maxLength={500} value={appearance.description} onChange={event => setAppearance(current => ({ ...current, description: event.target.value }))} /></label>
        <div className="flex flex-wrap gap-6">{([['background', t("배경", "Background")], ['foreground', t("글자", "Text")], ['accent', t("강조", "Accent")]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm"><input aria-label={label} className="h-10 w-12 cursor-pointer" type="color" value={appearance[key]} onChange={event => setAppearance(current => ({ ...current, [key]: event.target.value }))} />{label}</label>)}</div>
        <label className="grid gap-2 text-sm">{t("카드 HTML", "Card HTML")}<textarea className="form-field min-h-40 font-mono text-sm" spellCheck={false} value={appearance.cardHtml} onChange={event => setAppearance(current => ({ ...current, cardHtml: event.target.value }))} /></label>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-ink text-white`} disabled={busy} onClick={() => { if (canLeave()) void perform(saveAppearance); }}><Save size={16} />{t("적용", "Apply")}</button><button className={button} disabled={busy} onClick={() => void perform(async () => { const value = await command<LabSettings>({ action: "settings_get" }); setSettings(value); setAppearance(value.appearance); })}><RefreshCw size={16} />{t("최신 설정 불러오기", "Load latest settings")}</button><button className={button} onClick={() => setAppearance({ ...defaultLabAppearance })}>{t("기본 디자인", "Default design")}</button></div>
      </section>}
      {loading ? <p role="status" className="py-12 text-sm">{t("작업을 불러오는 중입니다.", "Loading work.")}</p> : <div className={`grid gap-6 ${toolsOpen ? "lg:grid-cols-[250px_minmax(0,1fr)]" : ""}`}>
        {toolsOpen && <aside className="min-w-0 space-y-3 lg:border-r lg:border-ink/15 lg:pr-5">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">{t("시험 기능", "Prototypes")}</h2><div className="flex gap-1"><button type="button" className={iconButton} title={t("새로고침", "Refresh")} aria-label={t("새로고침", "Refresh")} disabled={busy} onClick={() => void perform(refresh)}><RefreshCw size={17} /></button><button type="button" className={iconButton} title={t("새 기능", "New prototype")} aria-label={t("새 기능", "New prototype")} disabled={busy} onClick={() => { if (!canLeave()) return; setDetail(null); setEditor(empty); setRevisionId(""); setDirty(false); newId.current = null; setTab("source"); }}><Plus size={18} /></button></div></div>
          {!projects.length && <p className="py-5 text-sm text-muted">{t("등록된 시험 기능이 없습니다.", "No prototypes yet.")}</p>}
          <ul className="space-y-2">{projects.map(project => <li key={project.id}><button type="button" disabled={busy} onClick={() => { if (canLeave()) void perform(async () => { await load(project.id); setTab("preview"); }); }} className={`w-full rounded border p-3 text-left ${detail?.project.id === project.id ? "border-teal-800 bg-teal-50" : "border-ink/15 bg-white/50"}`}><span className="block break-words font-semibold">{project.title}</span><span className="mt-2 block text-xs text-muted">v{project.revision} · {project.review_state === "review_requested" ? t("검토 요청", "Review requested") : t("개발 중", "Draft")}</span></button></li>)}</ul>
        </aside>}
        <section className="min-w-0 space-y-4">
          {!toolsOpen && projects.length > 1 && <select className="form-field max-w-md bg-white text-ink" aria-label={t("결과물 선택", "Select result")} value={detail?.project.id || ""} disabled={busy} onChange={event => void perform(async () => { await load(event.target.value); setTab("preview"); })}>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select>}
          {toolsOpen && <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={t("작업 화면", "Workspace view")} className="inline-flex border-b border-ink/20">{(["source", "preview"] as const).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === value ? "border-teal-800 text-teal-900" : "border-transparent text-muted"}`}>{value === "source" ? <Code2 size={17} /> : <Play size={17} />}{value === "source" ? t("편집", "Edit") : t("실행", "Run")}</button>)}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={iconButton} title={t("파일 가져오기", "Import file")} aria-label={t("파일 가져오기", "Import file")} disabled={busy} onClick={() => fileInput.current?.click()}><FileUp size={17} /></button>
              <input ref={fileInput} type="file" accept=".html,.htm,.json" className="sr-only" aria-label={t("기능 파일", "Prototype file")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void perform(() => importFile(file)); }} />
              <button type="button" className={iconButton} title={t("입력 내보내기", "Export edits")} aria-label={t("입력 내보내기", "Export edits")} disabled={!editor.html} onClick={() => { void perform(async () => download("kline-prototype.json", JSON.stringify({ ...editor, fixture: JSON.parse(editor.fixture) }, null, 2))); }}><Download size={17} /></button>
              <button type="button" className={button} disabled={!revisionId || busy} onClick={() => void perform(async () => { const source = await command<{ files: Record<string, string>; sourceHash: string } | null>({ action: "source_get", revisionId }); if (!source) { setNotice(t("이 버전에는 소스 묶음이 없습니다.", "This revision has no source archive.")); return; } download("kline-lab-source.json", JSON.stringify(source, null, 2)); })}><Code2 size={16} />{t("소스 다운로드", "Download source")}</button>
              <button type="button" disabled={busy} onClick={() => void perform(save)} className={`${button} bg-ink text-white`}><Save size={17} />{t("저장 · 실행", "Save & run")}</button>
            </div>
          </div>}
          {tab === "source" ? <div role="tabpanel" className="space-y-4">
            <label className="grid gap-2 text-sm font-semibold">{t("기능 이름", "Feature name")}<input className="form-field" maxLength={120} value={editor.title} onChange={event => update("title", event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">{t("변경 내용", "Change description")}<textarea className="form-field" rows={2} maxLength={2000} value={editor.description} onChange={event => update("description", event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">HTML<textarea className="form-field min-h-80 font-mono text-sm" spellCheck={false} value={editor.html} onChange={event => update("html", event.target.value)} /></label>
            <label className="grid gap-2 text-sm font-semibold">{t("테스트 데이터", "Test data")}<textarea className="form-field min-h-32 font-mono text-sm" spellCheck={false} value={editor.fixture} onChange={event => update("fixture", event.target.value)} /></label>
          </div> : <div role="tabpanel" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">{detail?.project.title || t("새 기능", "New prototype")}</h2><div className="flex items-center gap-2">{toolsOpen && <span role="status" className="text-xs text-muted">{previewStatus}</span>}{toolsOpen && detail && <select aria-label={t("실행 버전", "Run version")} className="min-h-11 max-w-48 rounded border border-ink/20 bg-white px-3 text-sm" value={revisionId} onChange={event => { setRevisionId(event.target.value); setPreviewStatus(""); }}>{detail.revisions.map(revision => <option key={revision.id} value={revision.id}>v{revision.revision} · {revision.created_by.split("@")[0]}</option>)}</select>}<button type="button" disabled={!revisionId || busy} className={iconButton} aria-label={t("최신 작업 불러오기", "Load latest work")} title={t("최신 작업 불러오기", "Load latest work")} onClick={() => void reloadResult()}><RefreshCw size={17} /></button></div></div>
            {previewEnabled ? <iframe key={`${revisionId}:${run}`} ref={frame} title={t("시험 기능 실행", "Prototype preview")} src={`${labApiPath}/preview/${revisionId}`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[75dvh] min-h-80 w-full rounded border border-ink/20 bg-white" /> : <div className="space-y-4 border border-dashed border-ink/20 px-5 py-16 text-center"><p>{t("아직 저장된 작업이 없습니다.", "No saved work yet.")}</p><button className={button} onClick={() => { setToolsOpen(true); setTab("source"); }}><Plus size={16} />{t("새 기능", "New prototype")}</button></div>}
            {toolsOpen && detail && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-4"><p className="text-sm text-muted">{detail.project.review_state === "review_requested" ? t("소유자 검토 대기", "Awaiting owner review") : t("개발 중", "Draft")}{dirty ? t(" · 저장하지 않은 입력 있음", " · Unsaved edits") : ""}</p><button type="button" className={button} disabled={busy || dirty || detail.project.review_state === "review_requested"} onClick={() => void perform(async () => { const result = await command<{ project: LabProject }>({ action: "review", id: detail.project.id, expectedRevision: detail.project.revision }); setDetail(current => current ? { ...current, project: result.project } : current); await refresh(); setNotice(t("소유자 검토를 요청했습니다. 공개 반영은 별도 승인 후 진행됩니다.", "Owner review requested. Public release requires separate approval.")); })}><Send size={16} />{t("소유자 검토 요청", "Request owner review")}</button></div>}
          </div>}
        </section>
      </div>}
    </div>
    {connecting && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 p-4"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="lab-connect-title" className="mx-auto my-6 max-w-2xl space-y-5 rounded-lg bg-paper p-5 shadow-xl sm:p-7"><div className="flex items-center justify-between gap-4"><h2 id="lab-connect-title" className="text-xl font-semibold">{t("개발 연결", "Development connection")}</h2><button autoFocus type="button" className={iconButton} aria-label={t("닫기", "Close")} onClick={() => { setConnecting(false); setToken(""); }}><X size={18} /></button></div>
      <div role="tablist" aria-label={t("연결 방식", "Connection method")} className="flex border-b border-ink/20">{(["codex", "gpt"] as const).map(mode => <button key={mode} type="button" role="tab" aria-selected={mode===connectionMode} onClick={() => setConnectionMode(mode)} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${mode===connectionMode ? "border-teal-800" : "border-transparent"}`}>{mode==="codex" ? "Codex" : "GPT Actions"}</button>)}</div>
      {connectionMode === "codex" ? <div role="tabpanel" className="space-y-4"><pre className="overflow-auto rounded border border-ink/20 bg-white p-3 text-xs">{`[mcp_servers.kline_lab]\nurl = "${window.location.origin}${labApiPath}/mcp"\nbearer_token_env_var = "KLINE_LAB_TOKEN"`}</pre><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void perform(() => copy(`[mcp_servers.kline_lab]\nurl = "${window.location.origin}${labApiPath}/mcp"\nbearer_token_env_var = "KLINE_LAB_TOKEN"`))}><Copy size={16} />{t("Codex 설정 복사", "Copy Codex config")}</button><button className={button} disabled={busy} onClick={() => void perform(async () => { const response = await fetch(`${labApiPath}/starter`, { cache: "no-store" }); if (!response.ok) throw new Error("LAB_UNAVAILABLE"); download("yuki-codex-lab.zip", await response.blob()); })}><Download size={16} />{t("개발 프로젝트 받기", "Download project")}</button></div></div> : <div role="tabpanel" className="space-y-4"><ol className="list-decimal space-y-3 pl-5 text-sm leading-6"><li>{t("개인 GPT의 Actions에서 스키마를 가져옵니다.", "Import the schema in your personal GPT's Actions settings.")}</li><li>{t("인증을 API Key · Bearer로 선택하고 아래 연결키를 입력합니다.", "Choose API Key authentication with Bearer and enter the connection key below.")}</li></ol><button type="button" className={button} disabled={busy} onClick={() => void perform(async () => { const response = await fetch(`${labApiPath}/schema`, { cache: "no-store" }); if (!response.ok) throw new Error("LAB_UNAVAILABLE"); const value = JSON.stringify(await response.json(), null, 2); setSchema(value); await copy(value); })}><Copy size={16} />{t("스키마 복사", "Copy schema")}</button></div>}
      <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={() => void perform(async () => { const value = await command<{ token: string; expiresAt: string }>({ action: "token_rotate" }); setToken(value.token); setExpiry(value.expiresAt); })}><KeyRound size={16} />{t("연결키 발급 · 갱신", "Issue / rotate key")}</button><button type="button" className={button} disabled={busy} onClick={() => void perform(async () => { await command({ action: "token_revoke" }); setToken(""); setNotice(t("연결을 해제했습니다.", "Connection revoked.")); })}>{t("연결 해제", "Revoke")}</button></div>
      {schema && <details><summary className="cursor-pointer text-sm">OpenAPI</summary><pre className="mt-2 max-h-48 overflow-auto rounded border border-ink/20 bg-white p-3 text-xs">{schema}</pre></details>}
      {token && <div className="space-y-2"><label className="grid gap-2 text-sm">{t("연결키 · 이 화면에서만 표시", "Connection key · Shown once")}<input readOnly type="password" autoComplete="off" value={token} className="form-field font-mono text-xs" /></label><button type="button" className={button} onClick={() => void perform(() => copy(token))}><Copy size={16} />{t("연결키 복사", "Copy key")}</button><p className="text-xs text-muted">{t("만료", "Expires")}: {new Date(expiry).toLocaleString(ko ? "ko-KR" : "en-US")}</p></div>}
      <p className="border-t border-ink/15 pt-4 text-sm leading-6 text-muted">{t("연결키는 공동개발실의 시험 기능만 조회·저장합니다. 운영 데이터와 저장소·배포에는 접근하지 않습니다. 외부 리소스 없이 실행할 수 있는 HTML을 사용하고 개인정보는 넣지 마세요.", "This key only reads and saves lab prototypes. It cannot access production data, repositories or deployments. Use self-contained HTML and synthetic data.")}</p>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-900">{notice}</p>}
    </section></div>}
  </main>;
}
