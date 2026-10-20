"use client";
import { useEffect, useRef, useState } from "react";
import { Archive, Check, Copy, Download, FileText, Image as ImageIcon, Pencil, Plus, RotateCw, Search, Sparkles, Upload, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { EventStudio } from "@/components/google-forms/EventStudio";
import { archiveClubs, archiveTypes, fileTypes, maxFileBytes, type ArchiveAccess, type ArchiveClub, type ArchiveItem, type ArchiveLabels } from "@/lib/eventArchive/model";

export async function archiveCommand<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/event-archive${path}`, { ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(175000), cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "ARCHIVE_UNAVAILABLE"); return data;
}
const names: Record<ArchiveClub, string> = { ecc: "ECC", hanhwal: "HANHWAL", social_impact_union: "Social Impact Union", unclassified: "Unclassified" };
const errors: Record<string, [string, string]> = {
  ARCHIVE_NOT_ENABLED: ["자료실은 아직 활성화되지 않았습니다. 기존 행사 만들기는 계속 사용할 수 있습니다.", "The archive is not enabled yet. Existing event creation remains available."],
  ARCHIVE_DATABASE_UNAVAILABLE: ["자료 저장소에 연결하지 못했습니다. 다시 시도해주세요.", "The archive database is unavailable. Please retry."],
  ORIGINAL_HASH_MISMATCH: ["원본 파일 검증에 실패했습니다. 같은 파일을 다시 선택해주세요.", "Original verification failed. Select the same file and retry."],
  IMPORT_BUSY: ["이 자료를 확인하고 있습니다. 잠시 후 다시 시도해주세요.", "This import is being verified. Retry shortly."],
  AI_ANALYSIS_CONSENT_REQUIRED: ["AI 분석 동의가 필요합니다. 원본은 이미 저장되어 있습니다.", "AI consent is required. The original is already saved."],
  ARCHIVE_AI_UNAVAILABLE: ["AI 분류를 완료하지 못했습니다. 원본은 유지되며 직접 분류할 수 있습니다.", "AI classification failed. The original is preserved and can be labeled manually."],
  UNSUPPORTED_FILE_TYPE: ["지원되는 이미지, PDF, DOCX, PPTX 또는 UTF-8 텍스트 파일을 선택해주세요.", "Choose a supported image, PDF, DOCX, PPTX or UTF-8 text file."],
};
type OriginalDescriptor = { name: string; size: number; mimeType: string; sha256: string };
type Receipt = { status: string; batch_id: string; results: { index: number; archiveId?: string; error?: string }[];
  files?: OriginalDescriptor[];
  archive_items?: { archive_id: string; original_preserved: boolean; duplicate: boolean }[];
  uploads?: { index: number; signedUrl: string }[] };
type LegacyPreview = { sources: { source: string; status: string; candidates: { id: string; title: string; kind: string; fileExists?: boolean }[] }[] };
async function describeOriginals(files: File[]): Promise<OriginalDescriptor[]> {
  const descriptors = [];
  for (const file of files) {
    const mimeType = fileTypes[file.name.split(".").at(-1)?.toLowerCase() || ""];
    if (!mimeType || file.size > maxFileBytes) throw new Error("UNSUPPORTED_FILE_TYPE");
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    descriptors.push({ name: file.name, size: file.size, mimeType,
      sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("") });
  }
  return descriptors;
}
function ImportRecovery({ busy, run, onReceipt }: { busy: boolean; run: (fn: () => Promise<void>) => Promise<void>; onReceipt: (r: Receipt) => void }) {
  const { language } = useLanguage(), ko = language === "ko", t = (a: string, b: string) => ko ? a : b;
  const [jobs, setJobs] = useState<{ batchId: string; clubKey: ArchiveClub; status: string; total: number; saved: number }[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null), [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  async function refresh() {
    const result = await archiveCommand<{ jobs: typeof jobs }>("/ingest", { action: "pending" });
    setJobs(result.jobs); setError("");
  }
  useEffect(() => { void refresh().catch(e => setError((e as Error).message)); }, []);
  async function resume() {
    if (!selected) return;
    const current = await archiveCommand<Receipt>("/ingest", { action: "status", batchId: selected.batch_id });
    const descriptors = await describeOriginals(files);
    const match = (expected: OriginalDescriptor, value: OriginalDescriptor) => expected.name === value.name && expected.size === value.size && expected.sha256 === value.sha256 && expected.mimeType === value.mimeType;
    if (descriptors.some(value => !current.files?.some(expected => match(expected, value)))) throw new Error("ORIGINAL_HASH_MISMATCH");
    for (const upload of current.uploads || []) {
      const expected = current.files?.[upload.index];
      const index = expected ? descriptors.findIndex(value => match(expected, value)) : -1;
      if (index < 0) continue; // Already uploaded bytes can be verified without selecting the file again.
      const response = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": expected!.mimeType, "x-upsert": "false" }, body: files[index] });
      if (!response.ok && response.status !== 409 && !(response.status === 400 && /already exists|Duplicate/i.test(await response.text()))) throw new Error("UPLOAD_NOT_RECEIVED");
    }
    const receipt = await archiveCommand<Receipt>("/ingest", { action: "finalize", batchId: current.batch_id });
    onReceipt(receipt);
    setSelected(receipt.status === "saved" ? null : await archiveCommand<Receipt>("/ingest", { action: "status", batchId: current.batch_id }));
    setFiles([]); await refresh();
  }
  return <section className="space-y-3 border-t border-ink/15 pt-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t("미완료 가져오기", "Unfinished imports")}</h2><button type="button" disabled={busy} aria-label="Refresh unfinished imports" title={t("새로고침", "Refresh")} className="flex h-11 w-11 items-center justify-center" onClick={() => void run(refresh)}><RotateCw className="h-4 w-4" /></button></div>
    {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
    {!jobs.length && !error && <p className="text-sm text-muted">{t("미완료 작업이 없습니다.", "No unfinished imports.")}</p>}
    <ul className="divide-y divide-ink/10">{jobs.map(job => <li key={job.batchId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><span>{names[job.clubKey]} · {job.saved}/{job.total} · {job.status}</span><button type="button" disabled={busy} className="min-h-11 border border-ink/20 px-3" onClick={() => void run(async () => { setSelected(await archiveCommand<Receipt>("/ingest", { action: "status", batchId: job.batchId })); setFiles([]); })}>{t("이어서 저장", "Resume import")}</button></li>)}</ul>
    {selected && <div className="space-y-3 border-t border-ink/15 pt-3">
      {selected.uploads?.length ? <><ul className="space-y-1 text-sm">{selected.uploads.map(upload => <li key={upload.index} className="break-all">{selected.files?.[upload.index]?.name}</li>)}</ul><input aria-label="Recovery original files" disabled={busy} type="file" multiple className="max-w-full text-xs" onChange={e => setFiles(Array.from(e.target.files || []))} /></> : null}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-paper" onClick={() => void run(resume)}><Check className="h-4 w-4" />{t("원본 확인 · 이어서 저장", "Verify and resume")}</button><button type="button" disabled={busy} aria-label="Close import recovery" title={t("닫기", "Close")} className="flex h-11 w-11 items-center justify-center" onClick={() => setSelected(null)}><X className="h-4 w-4" /></button></div>
    </div>}
  </section>;
}

function labelsFor(item: ArchiveItem): ArchiveLabels {
  if (item.derivedLabels) return item.derivedLabels;
  return { suggestedClub: item.club_key, itemType: item.item_type, title: item.title_suggestion, eventType: item.event_type, eventDate: item.event_date,
    language: item.language, academicTerm: item.academic_term, tags: item.suggested_tags, summary: item.summary, confidence: item.confidence ?? 0 };
}
function ArchiveThumbnail({ item, enlarged = false }: { item: ArchiveItem; enlarged?: boolean }) {
  const asset = item.assets?.find(a => a.mime_type.startsWith("image/")); const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    if (asset) void archiveCommand<{ url: string }>(`?id=${item.id}&asset=${asset.id}`).then(r => { if (live) setSrc(r.url); }).catch(() => undefined);
    return () => { live = false; };
  }, [item.id, asset?.id]);
  return <div className={`flex items-center justify-center overflow-hidden bg-ink/5 ${enlarged ? "h-[60dvh] min-h-48" : "aspect-[4/3]"}`}>
    {src ? <img src={src} alt={item.title_suggestion || asset?.original_filename || ""} onError={() => setSrc("")} className="h-full w-full object-contain" /> : asset ? <ImageIcon className="h-8 w-8 text-muted" /> : <FileText className="h-8 w-8 text-muted" />}
  </div>;
}
export function EventArchiveWorkspace({ access, canCreate }: { access: ArchiveAccess; canCreate: boolean }) {
  const { language } = useLanguage(); const ko = language === "ko"; const t = (a: string, b: string) => ko ? a : b;
  const [tab, setTab] = useState<"creator" | "archive" | "import">(canCreate ? "creator" : "archive");
  const [items, setItems] = useState<ArchiveItem[]>([]), [selected, setSelected] = useState<ArchiveItem | null>(null);
  const [labels, setLabels] = useState<ArchiveLabels | null>(null), [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(""), [club, setClub] = useState(""), [type, setType] = useState(""), [tag, setTag] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [batch, setBatch] = useState("");
  const [more, setMore] = useState(false), [references, setReferences] = useState<string[]>([]), [referenceClub, setReferenceClub] = useState<ArchiveClub>("ecc");
  const [texts, setTexts] = useState([""]), [files, setFiles] = useState<File[]>([]), [importClub, setImportClub] = useState<ArchiveClub>(access.clubs[0] || "ecc");
  const [consent, setConsent] = useState(false), [privacy, setPrivacy] = useState(false), [copyright, setCopyright] = useState(false), [source, setSource] = useState(false), [aiSearch, setAiSearch] = useState(false), [reviewAi, setReviewAi] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null), [pending, setPending] = useState<{ key: string; batchId?: string } | null>(null);
  const [versionText, setVersionText] = useState<string | null>(null), [legacy, setLegacy] = useState<LegacyPreview | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadSequence = useRef(0);
  const dialogOpen = selected !== null;
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]') || []).filter(el => el.getClientRects().length);
      if (!controls.length) return;
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [dialogOpen]);
  const writable = access.clubs.length > 0 && !access.readOnly;
  const mayEdit = selected && writable && access.clubs.includes(selected.club_key);
  const displayError = error ? errors[error]?.[ko ? 0 : 1] || t("작업을 완료하지 못했습니다", "The operation did not finish") + ` (${error})` : "";
  async function load(append = false) {
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ q: query, club, type, tag, from, to, batch, offset: String(append ? items.length : 0) });
      const r = await archiveCommand<{ items: ArchiveItem[]; hasMore: boolean }>(`?${params}`);
      if (sequence !== loadSequence.current) return;
      setItems(append ? [...items, ...r.items] : r.items); setMore(r.hasMore);
    } catch (e) { if (sequence === loadSequence.current) setError((e as Error).message); } finally { if (sequence === loadSequence.current) setLoading(false); }
  }
  useEffect(() => { if (tab === "archive") void load(); }, [tab, batch]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("archive");
    if (id) { setTab("archive"); void openItem(id); }
    const bundle = new URLSearchParams(window.location.search).get("batch");
    if (bundle) { setBatch(bundle); setTab("archive"); }
  }, []);
  async function openItem(id: string) {
    setError(""); setStatus("");
    try { const r = await archiveCommand<{ item: ArchiveItem }>(`?id=${id}`); setSelected(r.item); setLabels(labelsFor(r.item)); setEditing(false); setVersionText(null); setPrivacy(false); setCopyright(false); setSource(false); setAiSearch(r.item.ai_search_allowed); setReviewAi(r.item.ai_consent); }
    catch (e) { setError((e as Error).message); }
  }
  async function task(fn: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); setStatus("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function chooseFiles(next: File[]) { if (!busy) { setFiles(current => [...current, ...next]); setPending(null); } }
  async function importBatch() {
    const key = pending?.key || crypto.randomUUID(); setPending({ key, batchId: pending?.batchId });
    const descriptors = await describeOriginals(files);
    setStatus(t("원본 저장을 준비하고 있습니다.", "Preparing the original import."));
    const prepared = await archiveCommand<Receipt>("/ingest", { clubKey: importClub, idempotencyKey: key, texts: texts.filter(s => s.length > 0), files: descriptors, sourceKind: files.length ? "upload" : "paste", aiConsent: consent, upstreamFormatting: "unknown" });
    setPending({ key, batchId: prepared.batch_id });
    for (const upload of prepared.uploads || []) {
      setStatus(t(`파일 ${upload.index + 1}을 원본 그대로 업로드하고 있습니다.`, `Uploading original file ${upload.index + 1}.`));
      const r = await fetch(upload.signedUrl, { method: "PUT", headers: { "Content-Type": descriptors[upload.index].mimeType, "x-upsert": "false" }, body: files[upload.index] });
      if (!r.ok && r.status !== 409 && !(r.status === 400 && /already exists|Duplicate/i.test(await r.text()))) throw new Error("UPLOAD_NOT_RECEIVED");
    }
    setStatus(t("저장된 원본과 SHA-256을 다시 확인하고 있습니다.", "Verifying stored originals and SHA-256."));
    const r = await archiveCommand<Receipt>("/ingest", { action: "finalize", batchId: prepared.batch_id }); setReceipt(r);
    if (r.status !== "saved") { setStatus(t("일부 자료만 저장되었습니다. 실패한 항목을 확인하고 재시도해주세요.", "Some items were saved. Check failed items and retry.")); return; }
    setStatus(t("모든 원본이 검증되어 저장되었습니다.", "All originals were verified and saved."));
    if (consent) {
      let failures = 0;
      for (const id of [...new Set(r.results.flatMap(i => i.archiveId ? [i.archiveId] : []))]) {
        try { await archiveCommand("", { action: "classify", id }); } catch { failures++; }
      }
      if (failures) setStatus(t(`원본 저장 완료. ${failures}건의 AI 분류는 직접 검토가 필요합니다.`, `Originals saved. ${failures} AI classifications need manual review.`));
    }
    setPending(null); setTexts([""]); setFiles([]);
  }
  function exportLocalNotices() {
    const entries = Object.keys(localStorage).filter(k => /(?:board|notice|announcement|post)/i.test(k) && !/auth|token|secret|session|credential/i.test(k)).map(key => ({ key, originalValue: localStorage.getItem(key) }));
    const blob = new Blob([JSON.stringify({ source: "this-browser-only", exportedAt: new Date().toISOString(), entries }, null, 2)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "kline-local-notices.txt"; a.click(); URL.revokeObjectURL(url);
    setStatus(t(`${entries.length}개의 공지 관련 항목을 이 브라우저에서 내보냈습니다.`, `Exported ${entries.length} notice-related entries from this browser.`));
  }
  return <div className="space-y-6">
    <nav className="flex overflow-x-auto border-b border-ink/15" aria-label="Event Studio views">
      {([...(canCreate ? ["creator"] : []), "archive", ...(writable ? ["import"] : [])] as const).map(view => <button key={view} type="button" aria-current={tab === view ? "page" : undefined} onClick={() => { setTab(view as typeof tab); setError(""); setStatus(""); }} className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === view ? "border-navy text-navy" : "border-transparent text-muted"}`}>
        {view === "creator" ? <Sparkles className="h-4 w-4" /> : view === "archive" ? <Archive className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        {view === "creator" ? "AI Creator" : view === "archive" ? "Event Archive" : "Import Center"}
      </button>)}
    </nav>
    {displayError && <p role="alert" className="border-l-2 border-red-600 pl-3 text-sm text-red-700">{displayError}</p>}
    {status && <p role="status" className="text-sm text-muted">{status}</p>}
    {tab === "creator" && <>
      {references.length > 0 && <div className="flex items-center justify-between gap-3 border-b border-ink/15 pb-3 text-sm"><p>{t("참고 원본", "Historical references")}: {references.length}</p><button type="button" title={t("참고 자료 해제", "Clear references")} aria-label="Clear references" className="flex h-11 w-11 items-center justify-center" onClick={() => setReferences([])}><X className="h-4 w-4" /></button></div>}
      <EventStudio initialClub={references.length && referenceClub !== "unclassified" ? referenceClub : undefined} archiveIds={references} />
    </>}
    {tab === "archive" && <>
      {batch && <div className="flex items-start justify-between gap-3 border-b border-ink/15 pb-4"><div><h2 className="break-words text-lg font-semibold">{items[0]?.collection?.title || t("행사 묶음", "Event collection")}</h2><p className="text-sm text-muted">{items[0]?.collection?.eventDate} · {items.length} {t("건", "materials")}</p></div><button type="button" aria-label="Clear collection filter" title={t("전체 자료 보기", "All materials")} className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={() => setBatch("")}><X className="h-4 w-4" /></button></div>}
      <form onSubmit={e => { e.preventDefault(); void load(); }} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 sm:col-span-2"><Search className="h-5 w-5 shrink-0" /><input aria-label={t("자료 검색", "Search archive")} className="form-field min-w-0 flex-1" placeholder={t("제목·원문·내용 검색", "Search title, original and summary")} value={query} onChange={e => setQuery(e.target.value)} /></label>
        <select aria-label={t("클럽", "Club")} className="form-field" value={club} onChange={e => setClub(e.target.value)}><option value="">{t("전체 클럽", "All clubs")}</option>{archiveClubs.map(c => <option key={c} value={c}>{names[c]}</option>)}</select>
        <select aria-label={t("자료 유형", "Document type")} className="form-field" value={type} onChange={e => setType(e.target.value)}><option value="">{t("전체 유형", "All types")}</option>{archiveTypes.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input aria-label={t("태그", "Tag")} className="form-field" placeholder={t("태그", "Tag")} value={tag} onChange={e => setTag(e.target.value)} />
        <label className="grid gap-1 text-xs text-muted">{t("행사일 시작", "Event date from")}<input aria-label="Event date from" type="date" className="form-field" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-xs text-muted">{t("행사일 끝", "Event date to")}<input aria-label="Event date to" type="date" className="form-field" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 self-end bg-ink px-4 py-3 text-sm text-paper disabled:opacity-40"><Search className="h-4 w-4" />{t("검색", "Search")}</button>
      </form>
      {loading && <p role="status" className="text-sm">{t("자료를 불러오고 있습니다.", "Loading archive materials.")}</p>}
      {!loading && !items.length && !error && <div className="flex min-h-48 flex-col items-center justify-center gap-3 border-t border-ink/15 text-muted"><Archive className="h-7 w-7" /><p>{t("표시할 자료가 없습니다.", "No materials to display.")}</p></div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} type="button" onClick={() => void openItem(item.id)} className="overflow-hidden rounded-lg border border-ink/15 bg-white/60 text-left transition hover:border-brass focus-visible:outline-navy">
        <ArchiveThumbnail item={item} /><div className="space-y-2 p-4"><p className="text-xs text-muted">{names[item.club_key]} · {item.item_type} · {item.visibility === "public" ? t("공개", "Public") : t("비공개", "Private")}</p>
          <h2 className="break-words font-semibold text-navy">{item.title_suggestion || item.assets?.[0]?.original_filename || t("미분류 원본", "Unclassified original")}</h2><p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted">{item.summary || item.original_text}</p><p className="text-xs text-muted">{item.event_date || t("날짜 미확인", "Date unconfirmed")} · {item.classification_status}</p>
          {item.collection && <p className="break-words text-xs text-muted">{item.collection.title}</p>}
        </div></button>)}</div>
      {more && <button type="button" className="min-h-11 border border-ink/20 px-4 text-sm" disabled={loading} onClick={() => void load(true)}>{t("더 보기", "Load more")}</button>}
    </>}
    {tab === "import" && <div className="space-y-5">
      <label className="grid max-w-sm gap-2 text-sm font-semibold">{t("보관할 단체", "Access scope")}<select disabled={busy} className="form-field" value={importClub} onChange={e => { setImportClub(e.target.value as ArchiveClub); setPending(null); }}>{access.clubs.map(c => <option key={c} value={c}>{names[c]}</option>)}</select></label>
      {texts.map((text, i) => <label key={i} className="grid gap-2 text-sm font-semibold">{t("공지 원문", "Original notice")} {i + 1}<textarea disabled={busy} aria-label={`Original notice ${i + 1}`} className="form-field min-h-40 font-normal" value={text} onChange={e => { setTexts(texts.map((s, n) => n === i ? e.target.value : s)); setPending(null); }} /></label>)}
      <button type="button" disabled={busy || texts.length + files.length >= 20} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm" onClick={() => { setTexts([...texts, ""]); setPending(null); }}><Plus className="h-4 w-4" />{t("원문 추가", "Add notice")}</button>
      <label onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); chooseFiles(Array.from(e.dataTransfer.files)); }} className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink/30 px-5 py-6 text-sm">
        <Upload className="h-6 w-6 text-muted" /><span>{t("포스터·문서 선택", "Choose posters and documents")}</span><input aria-label="Original files" disabled={busy} type="file" multiple accept={Object.keys(fileTypes).map(e => `.${e}`).join(",")} className="max-w-full text-xs" onChange={e => { chooseFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      </label>
      {files.length > 0 && <ol className="divide-y divide-ink/10">{files.map((f, i) => <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-all">{f.name} · {(f.size / 1048576).toFixed(2)} MB</span><button type="button" disabled={busy} title={t("파일 제외", "Remove file")} aria-label="Remove file" className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={() => { setFiles(files.filter((_, n) => n !== i)); setPending(null); }}><X className="h-4 w-4" /></button></li>)}</ol>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={consent} onChange={e => { setConsent(e.target.checked); setPending(null); }} className="mt-1" />{t("선택한 원문·파일을 OpenAI에 전달하여 비공개 분류 초안을 만드는 데 동의합니다.", "I consent to sending selected originals to OpenAI for private label suggestions.")}</label>
      <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !texts.some(s => s.length) && !files.length} onClick={() => void task(importBatch)} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 py-3 text-sm text-paper disabled:opacity-40"><Check className="h-4 w-4" />{pending ? t("같은 요청 재시도", "Retry this import") : t("비공개 저장", "Save privately")}</button>
        {pending?.batchId && <button type="button" disabled={busy} className="min-h-11 border border-ink/20 px-4 text-sm" onClick={() => void task(async () => { setReceipt(await archiveCommand<Receipt>("/ingest", { action: "status", batchId: pending.batchId })); })}>{t("저장 상태 확인", "Check import status")}</button>}
      </div>
      {receipt && <section className="border-t border-ink/15 pt-4"><h2 className="text-sm font-semibold">{t("저장 결과", "Import receipt")} · {receipt.status}</h2><ol className="mt-3 space-y-2 text-sm">{receipt.results.map(r => <li key={r.index}>{r.index + 1}. {r.archiveId ? <button type="button" className="underline underline-offset-4" onClick={() => { setTab("archive"); void openItem(r.archiveId!); }}>{t("저장된 원본 열기", "Open verified original")}</button> : r.error}</li>)}</ol></section>}
      <ImportRecovery busy={busy} run={task} onReceipt={setReceipt} />
      <details className="border-t border-ink/15 pt-4"><summary className="cursor-pointer text-sm font-semibold">{t("기존 자료 가져오기", "Import existing materials")}</summary><div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={busy} className="min-h-11 border border-ink/20 px-4 text-sm" onClick={() => void task(async () => { setLegacy(await archiveCommand<LegacyPreview>("/legacy")); })}>{t("가져오기 미리보기", "Preview existing sources")}</button>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-4 text-sm" onClick={exportLocalNotices}><Download className="h-4 w-4" />{t("이 브라우저 공지 내보내기", "Export this browser's notices")}</button>
      </div>{legacy && <div className="mt-4 divide-y divide-ink/10">{legacy.sources.map(s => <section key={s.source} className="py-3"><h3 className="break-all text-sm font-semibold">{s.source} · {s.status}</h3><ul className="mt-2 space-y-2">{s.candidates.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{c.title} {c.fileExists === false && t("(파일 확인 필요)", "(File unavailable)")}</span><button type="button" disabled={busy || c.fileExists === false} className="min-h-11 border border-ink/20 px-3" onClick={() => void task(async () => { const r = await archiveCommand<Receipt>("/legacy", { source: s.source, id: c.id, confirmed: true }); setReceipt(r); setStatus(t("기존 자료는 유지하고 새 아카이브에 복사했습니다.", "Copied to the archive without modifying the source.")); })}>{t("승인 · 복사", "Approve copy")}</button></li>)}</ul></section>)}</div>}</details>
    </div>}
    {selected && <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("자료 원본", "Archive original")} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <section className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-paper shadow-xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/15 p-4"><div className="min-w-0"><p className="text-xs text-muted">{names[selected.club_key]} · {selected.visibility} · {selected.review_status}</p><h2 className="mt-1 break-words font-semibold text-navy">{selected.title_suggestion || t("자료 원본", "Original material")}</h2></div><button type="button" aria-label="Close original" title={t("닫기", "Close")} className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={() => setSelected(null)}><X className="h-5 w-5" /></button></header>
        <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
          {selected.assets?.some(asset => asset.mime_type.startsWith("image/")) && <ArchiveThumbnail item={selected} enlarged />}
          {displayError && <p role="alert" className="border-l-2 border-red-600 pl-3 text-sm text-red-700">{displayError}</p>}
          {status && <p role="status" className="text-sm text-muted">{status}</p>}
          {selected.original_text !== null && <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{t("원문", "Original text")}</h3><button type="button" aria-label="Copy original" title={t("원문 복사", "Copy original")} className="flex h-11 w-11 items-center justify-center" onClick={() => void task(async () => { await navigator.clipboard.writeText(selected.original_text!); setStatus(t("원문을 복사했습니다.", "Original copied.")); })}><Copy className="h-4 w-4" /></button></div><pre className="whitespace-pre-wrap break-words border-y border-ink/15 py-4 font-sans text-sm leading-7">{selected.original_text}</pre><p className="mt-2 break-all text-xs text-muted">SHA-256: {selected.original_text_sha256}</p></section>}
          {selected.assets?.map(asset => <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3"><div className="min-w-0"><p className="break-all text-sm">{asset.original_filename}</p><p className="break-all text-xs text-muted">SHA-256: {asset.sha256}</p></div><button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm" onClick={() => void task(async () => { const r = await archiveCommand<{ url: string }>(`?id=${selected.id}&asset=${asset.id}`); const a = document.createElement("a"); a.href = r.url; a.rel = "noopener noreferrer"; a.click(); })}><Download className="h-4 w-4" />{t("원본 다운로드", "Download original")}</button></div>)}
          {selected.versions && selected.versions.length > 0 && <section><h3 className="text-sm font-semibold">{t("연결된 버전", "Linked versions")}</h3><ul className="mt-2 space-y-2">{selected.versions.map(v => { const id = v.original_item_id === selected.id ? v.version_item_id : v.original_item_id; return <li key={id}><button type="button" className="break-all text-sm underline" onClick={() => void openItem(id)}>{id}</button></li>; })}</ul></section>}
          <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{t("분류 · 파생 메타데이터", "Labels · Derived metadata")}</h3>{mayEdit && <button type="button" title={t("분류 편집", "Edit labels")} aria-label="Edit labels" className="flex h-11 w-11 items-center justify-center" onClick={() => setEditing(!editing)}><Pencil className="h-4 w-4" /></button>}</div>
            {!editing ? <><p className="text-sm">{labels?.organizerName} {labels?.eventName && `· ${labels.eventName}`}</p><p className="text-sm">{selected.summary || t("요약 없음", "No summary")}</p><p className="text-xs text-muted">{selected.suggested_tags.join(" / ")}</p></> : labels && <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void task(async () => { await archiveCommand("", { action: "labels", id: selected.id, labels }); await openItem(selected.id); }); }}>
              <label className="grid gap-1 text-sm">{t("주최 단체", "Organizer")}<input className="form-field" value={labels.organizerName || ""} onChange={e => setLabels({ ...labels, organizerName: e.target.value || null })} /></label>
              <label className="grid gap-1 text-sm">{t("행사명", "Event name")}<input className="form-field" value={labels.eventName || ""} onChange={e => setLabels({ ...labels, eventName: e.target.value || null })} /></label>
              <label className="grid gap-1 text-sm">{t("제목", "Title")}<input className="form-field" value={labels.title || ""} onChange={e => setLabels({ ...labels, title: e.target.value || null })} /></label>
              <label className="grid gap-1 text-sm">{t("추정 단체", "Suggested organization")}<select className="form-field" value={labels.suggestedClub} onChange={e => setLabels({ ...labels, suggestedClub: e.target.value as ArchiveLabels["suggestedClub"] })}>{[...archiveClubs, "other"].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
              <label className="grid gap-1 text-sm">{t("유형", "Type")}<select className="form-field" value={labels.itemType} onChange={e => setLabels({ ...labels, itemType: e.target.value as ArchiveLabels["itemType"] })}>{archiveTypes.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="grid gap-1 text-sm">{t("행사 유형", "Event type")}<input className="form-field" value={labels.eventType || ""} onChange={e => setLabels({ ...labels, eventType: e.target.value || null })} /></label>
              <label className="grid gap-1 text-sm">{t("행사일", "Historical date")}<input type="date" className="form-field" value={labels.eventDate || ""} onChange={e => setLabels({ ...labels, eventDate: e.target.value || null })} /></label>
              <label className="grid gap-1 text-sm">{t("태그", "Tags")}<input className="form-field" value={labels.tags.join(", ")} onChange={e => setLabels({ ...labels, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} /></label>
              <label className="grid gap-1 text-sm sm:col-span-2">{t("요약", "Summary")}<textarea className="form-field min-h-24" value={labels.summary || ""} onChange={e => setLabels({ ...labels, summary: e.target.value || null })} /></label><button disabled={busy} className="min-h-11 bg-ink px-4 text-sm text-paper">{t("분류 저장", "Save labels")}</button>
            </form>}
          </section>
          {mayEdit && <>
            <button type="button" disabled={busy || !selected.ai_consent} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm disabled:opacity-40" onClick={() => void task(async () => { await archiveCommand("", { action: "classify", id: selected.id }); await openItem(selected.id); })}><Sparkles className="h-4 w-4" />{t("AI 분류", "Classify with AI")}</button>
            <details className="border-t border-ink/15 pt-4"><summary className="cursor-pointer text-sm font-semibold">{t("검수 · 공개 설정", "Review and visibility")}</summary><div className="mt-4 space-y-3 text-sm">
              {([[privacy, setPrivacy, t("개인정보 확인", "Privacy checked")], [copyright, setCopyright, t("저작권 확인", "Copyright checked")], [source, setSource, t("출처 확인", "Source checked")], [reviewAi, setReviewAi, t("OpenAI 분석 전달 허용", "Allow sending to OpenAI")], [aiSearch, setAiSearch, t("새 행사 작성 시 AI 참고 허용", "Allow AI reference for new events")]] as const).map(([checked, setter, title]) => <label key={title} className="flex items-start gap-2"><input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} className="mt-1" />{title}</label>)}
              <div className="flex flex-wrap gap-2">{(["private", "public"] as const).map(visibility => <button type="button" key={visibility} disabled={busy || !privacy || !copyright || !source || selected.club_key === "unclassified" && visibility === "public"} className="inline-flex min-h-11 items-center gap-2 border border-ink/20 px-3 text-sm disabled:opacity-40" onClick={() => void task(async () => { await archiveCommand("", { action: "review", id: selected.id, confirmed: true, visibility, checklist: { privacy, copyright, source }, aiConsent: reviewAi, aiSearchAllowed: aiSearch }); await openItem(selected.id); })}><Check className="h-4 w-4" />{visibility === "public" ? t("검수 승인 · 공개", "Approve and publish") : t("검수 승인 · 비공개", "Approve privately")}</button>)}</div>
            </div></details>
            <details className="border-t border-ink/15 pt-4"><summary className="cursor-pointer text-sm font-semibold">{t("새 버전 작성", "Create a new version")}</summary><textarea aria-label="New version text" className="form-field mt-3 min-h-32" value={versionText ?? selected.original_text ?? ""} onChange={e => setVersionText(e.target.value)} /><button type="button" disabled={busy || versionText === null} className="mt-3 min-h-11 border border-ink/20 px-3 text-sm" onClick={() => void task(async () => { await archiveCommand("", { action: "version", id: selected.id, text: versionText, idempotencyKey: crypto.randomUUID() }); await load(); setStatus(t("원본을 유지하고 새 버전을 저장했습니다.", "Saved a new version without replacing the original.")); })}>{t("별도 버전 저장", "Save separate version")}</button></details>
          </>}
          {canCreate && selected.review_status === "approved" && selected.ai_consent && selected.ai_search_allowed && selected.club_key !== "unclassified" && <button type="button" className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-paper" onClick={() => { setReferences([selected.id]); setReferenceClub(selected.club_key); setSelected(null); setTab("creator"); }}><Plus className="h-4 w-4" />{t("참고하여 행사 만들기", "Create with this reference")}</button>}
        </div>
      </section>
    </div>}
  </div>;
}
