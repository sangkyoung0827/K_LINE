"use client";

import Link from "next/link";
import { ArrowLeft, Download, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { researchCategories, researchTopics, researchDocumentType, type ResearchItem } from "@/lib/research/model";

const base = "/open-k-culture-research";
const mediaUrl = (item: ResearchItem, path: string) => `/api/research/media/${item.id}/${path.split("/").pop()}`;
const paragraphize = (body: string) => body.split(/\n\s*\n/).filter(Boolean);
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

export function ResearchDetail({ initialItem, canEdit, startEditing = false }: { initialItem: ResearchItem; canEdit: boolean; startEditing?: boolean }) {
  const { language } = useLanguage();
  const [item, setItem] = useState(initialItem);
  const [draft, setDraft] = useState(initialItem);
  const [editing, setEditing] = useState(canEdit && startEditing);
  const [displayLanguage, setDisplayLanguage] = useState<"ko" | "en" | "both">("both");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const titleKey = language === "ko" ? "titleKo" : "titleEn";
  const bodyKey = language === "ko" ? "bodyKo" : "bodyEn";
  const subtitleKey = language === "ko" ? "subtitleKo" : "subtitleEn";
  const summaryKey = language === "ko" ? "summaryKo" : "summaryEn";

  const update = <K extends keyof ResearchItem>(key: K, value: ResearchItem[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (status = draft.status) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/research/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, status, visibility: status === "published" ? "public" : draft.visibility })
      });
      const data = await response.json() as { item?: ResearchItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Save failed.");
      setItem(data.item); setDraft(data.item); setEditing(false);
      setMessage(language === "ko" ? "연구자료가 저장되었습니다." : "Research item saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); }
    finally { setBusy(false); }
  };

  const upload = async (file: File | undefined, kind: "cover" | "image" | "attachment") => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let response: Response;
      if (kind === "attachment") {
        const type = researchDocumentType(file.name);
        if (!type || file.size > 10 * 1024 * 1024 || file.size === 0) throw new Error(language === "ko" ? "PDF, DOCX, HWP, HWPX, PPT, PPTX 파일을 10MB 이하로 선택해주세요." : "Choose a PDF, DOCX, HWP, HWPX, PPT, or PPTX file up to 10 MB.");
        const ticketResponse = await fetch(`/api/research/${item.id}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ticket", fileName: file.name, size: file.size })
        });
        const ticket = await ticketResponse.json() as { path?: string; signedUrl?: string; mimeType?: string; error?: string };
        if (!ticketResponse.ok || !ticket.path || !ticket.signedUrl || !ticket.mimeType) throw new Error(ticket.error || "Upload could not start.");
        const body = new FormData();
        body.append("cacheControl", "3600");
        body.append("", new File([file], file.name, { type: ticket.mimeType }));
        const uploaded = await fetch(ticket.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body });
        if (!uploaded.ok) throw new Error("File upload failed.");
        response = await fetch(`/api/research/${item.id}/upload`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize", path: ticket.path, size: file.size })
        });
      } else {
        const form = new FormData(); form.set("file", file); form.set("kind", kind);
        response = await fetch(`/api/research/${item.id}/upload`, { method: "POST", body: form });
      }
      const data = await response.json() as { item?: ResearchItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Upload failed.");
      setItem(data.item); setDraft((current) => ({ ...current, coverPath: data.item!.coverPath, imagePaths: data.item!.imagePaths, attachmentPaths: data.item!.attachmentPaths }));
      setMessage(language === "ko" ? "파일이 업로드되었습니다." : "File uploaded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(language === "ko" ? "이 연구자료를 완전히 삭제하시겠습니까?" : "Delete this research item permanently?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/research/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed.");
      window.location.href = base;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Delete failed."); setBusy(false); }
  };

  const removeFile = async (path: string) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/research/${item.id}/upload`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path })
      });
      const data = await response.json() as { item?: ResearchItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "File removal failed.");
      setItem(data.item); setDraft((current) => ({ ...current, coverPath: data.item!.coverPath, imagePaths: data.item!.imagePaths, attachmentPaths: data.item!.attachmentPaths }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "File removal failed."); }
    finally { setBusy(false); }
  };

  const field = (label: string, key: keyof ResearchItem, multiline = false) => <label className="grid gap-1.5 text-sm font-semibold text-navy" key={String(key)}>
    {label}
    {multiline ? <textarea value={String(draft[key] || "")} onChange={(event) => update(key, event.target.value as never)} rows={key === "bodyKo" || key === "bodyEn" ? 12 : 3} className="form-field !rounded-md" />
      : <input value={String(draft[key] || "")} onChange={(event) => update(key, event.target.value as never)} className="form-field !rounded-md" />}
  </label>;

  const title = language === "ko" ? item.titleKo || item.titleEn : item.titleEn || item.titleKo;
  const summary = language === "ko" ? item.summaryKo || item.summaryEn : item.summaryEn || item.summaryKo;

  return <article className="bg-paper px-4 py-8 sm:px-6 sm:py-12 md:py-16">
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="inline-flex items-center gap-2 text-sm font-semibold text-navy"><ArrowLeft aria-hidden className="h-4 w-4" />{language === "ko" ? "연구 아카이브" : "Research archive"}</Link>
        {canEdit ? <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setDraft(item); setEditing(!editing); }} className="inline-flex min-h-10 items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-navy"><Pencil aria-hidden className="h-4 w-4" />{editing ? (language === "ko" ? "편집 닫기" : "Close editor") : (language === "ko" ? "편집" : "Edit")}</button>
          <button type="button" onClick={remove} disabled={busy} title={language === "ko" ? "연구자료 삭제" : "Delete research item"} className="inline-flex min-h-10 items-center gap-2 border border-red-300 px-3 text-sm text-red-700"><Trash2 aria-hidden className="h-4 w-4" />{language === "ko" ? "삭제" : "Delete"}</button>
        </div> : null}
      </div>
      {message ? <p role="status" className="mt-4 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}

      {editing ? <div className="mt-7 grid gap-6 border-t border-navy/15 pt-6">
        {field(language === "ko" ? "제목" : "Title", titleKey)}
        {field(language === "ko" ? "본문 (파일만 등록할 경우 비워두세요)" : "Body (optional for file uploads)", bodyKey, true)}
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-navy"><Upload aria-hidden className="h-4 w-4" />{language === "ko" ? "문서 업로드" : "Upload document"}<input type="file" accept=".pdf,.docx,.hwp,.hwpx,.ppt,.pptx" className="sr-only" disabled={busy} onChange={(event) => { upload(event.target.files?.[0], "attachment"); event.target.value = ""; }} /></label>
          <span className="self-center text-xs text-muted">PDF · DOCX · HWP · HWPX · PPT · PPTX (10 MB)</span>
        </div>
        <details className="border-t border-navy/10 pt-4"><summary className="cursor-pointer text-sm font-semibold text-navy">{language === "ko" ? "추가 설정" : "More settings"}</summary><div className="mt-5 grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2">{field(language === "ko" ? "부제 (선택)" : "Subtitle (optional)", subtitleKey)}{field(language === "ko" ? "요약 (선택)" : "Summary (optional)", summaryKey, true)}</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-navy">Category
            <input list="research-category-options" value={draft.category} onChange={(event) => update("category", event.target.value)} className="form-field !rounded-md" />
            <datalist id="research-category-options">{researchCategories.map((value) => <option key={value} value={value} />)}</datalist>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-navy">Topic
            <input list="research-topic-options" value={draft.topic} onChange={(event) => update("topic", event.target.value)} className="form-field !rounded-md" />
            <datalist id="research-topic-options">{researchTopics.map((value) => <option key={value} value={value} />)}</datalist>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-navy">Tags (comma separated)
            <input value={draft.tags.join(", ")} onChange={(event) => update("tags", event.target.value.split(",").map((value) => value.trim()).filter(Boolean))} className="form-field !rounded-md" />
          </label>
          {field("Author / research team", "authorName")}{field("Author organization", "authorOrganization")}{field("Related organization ID", "relatedOrganizationId")}
          {field("Related activity ID", "relatedActivityId")}
          <label className="grid gap-1.5 text-sm font-semibold text-navy">Visibility
            <select value={draft.visibility} onChange={(event) => update("visibility", event.target.value as ResearchItem["visibility"])} className="form-field !rounded-md"><option value="private">Private</option><option value="members">Members (draft only)</option><option value="public">Public</option></select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-navy">Quotes (one per line)<textarea value={draft.quotes.join("\n")} onChange={(event) => update("quotes", lines(event.target.value))} rows={3} className="form-field !rounded-md" /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-navy">References (one per line)<textarea value={draft.references.join("\n")} onChange={(event) => update("references", lines(event.target.value))} rows={3} className="form-field !rounded-md" /></label>
        </div>
        <div className="flex flex-wrap gap-4 border-t border-navy/10 pt-5">
          {(["cover", "image"] as const).map((kind) => <label key={kind} className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-navy/20 px-3 text-sm font-semibold text-navy"><Upload aria-hidden className="h-4 w-4" />{kind === "cover" ? "Cover image" : "Body image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => upload(event.target.files?.[0], kind)} /></label>)}
        </div>
        </div></details>
        {item.coverPath || item.imagePaths.length || item.attachmentPaths.length ? <div className="grid gap-2 border-t border-navy/10 pt-5 text-sm text-navy">
          {[item.coverPath, ...item.imagePaths, ...item.attachmentPaths].filter(Boolean).map((path) => <div className="flex items-center justify-between gap-3 border border-navy/10 p-2" key={path}>
            <a href={mediaUrl(item, path)} className="min-w-0 truncate underline">{path === item.coverPath ? "Cover" : item.imagePaths.includes(path) ? "Image" : "Attachment"} · {path.split("/").pop()}</a>
            <button type="button" disabled={busy} onClick={() => removeFile(path)} title="Remove file" className="p-2 text-red-700"><X aria-hidden className="h-4 w-4" /></button>
          </div>)}
        </div> : null}
        <div className="flex flex-wrap gap-2 border-t border-navy/10 pt-5">
          <button type="button" disabled={busy} onClick={() => save("draft")} className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-navy"><Save aria-hidden className="h-4 w-4" />{language === "ko" ? "임시 저장" : "Save draft"}</button>
          <button type="button" disabled={busy || item.isSample} onClick={() => save("published")} className="inline-flex min-h-11 items-center gap-2 bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus aria-hidden className="h-4 w-4" />{language === "ko" ? "공개 등록" : "Publish"}</button>
          {item.status === "published" ? <button type="button" disabled={busy} onClick={() => save("archived")} className="min-h-11 border border-navy/20 px-4 text-sm font-semibold text-navy">Archive</button> : null}
        </div>
      </div> : <>
        <div className="mt-9 border-b border-navy/15 pb-7" onClick={canEdit ? () => setEditing(true) : undefined}>
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase text-brass"><span>{item.category}</span>{item.topic ? <><span aria-hidden>·</span><span>{item.topic}</span></> : null}{canEdit ? <span className="border border-navy/15 px-1.5 text-navy">{item.isSample ? "SAMPLE · " : ""}{item.status} / {item.visibility}</span> : null}</div>
          <h1 className="mt-4 font-serif text-3xl font-semibold text-navy sm:text-4xl">{title}</h1>
          {item.titleKo && item.titleEn ? <p className="mt-2 text-lg text-muted">{language === "ko" ? item.titleEn : item.titleKo}</p> : null}
          {summary ? <p className="mt-5 text-base leading-8 text-muted">{summary}</p> : null}
          {item.authorName || item.authorOrganization || item.publishedAt ? <p className="mt-5 text-sm text-navy">{item.authorName || item.authorOrganization} {item.authorName && item.authorOrganization ? `· ${item.authorOrganization}` : ""} {item.publishedAt ? `· ${new Date(item.publishedAt).toLocaleDateString(language === "ko" ? "ko-KR" : "en-US")}` : ""}</p> : null}
        </div>
        {item.coverPath ? <img src={mediaUrl(item, item.coverPath)} alt={title} className="mt-8 aspect-[16/9] w-full object-cover" /> : null}
        {item.attachmentPaths.find((path) => path.endsWith(".pdf")) ? <iframe title={title} src={mediaUrl(item, item.attachmentPaths.find((path) => path.endsWith(".pdf"))!)} className="mt-8 h-[70vh] min-h-96 w-full border border-navy/15" /> : null}
        {item.bodyKo && item.bodyEn ? <div className="mt-8 inline-flex border border-navy/15" aria-label="Article language">
          {(["both", "ko", "en"] as const).map((value) => <button key={value} type="button" onClick={() => setDisplayLanguage(value)} aria-pressed={displayLanguage === value} className={`min-h-10 px-4 text-sm font-semibold ${displayLanguage === value ? "bg-navy text-white" : "text-navy"}`}>{value === "both" ? "한국어 + English" : value === "ko" ? "한국어" : "English"}</button>)}
        </div> : null}
        <div className="mt-7 grid gap-8" onClick={canEdit ? () => setEditing(true) : undefined}>
          {(displayLanguage === "both" || displayLanguage === "ko") && item.bodyKo ? <section lang="ko" className="max-w-3xl space-y-5 text-base leading-8 text-navy">{paragraphize(item.bodyKo).map((text, index) => <p key={index} className="whitespace-pre-wrap">{text}</p>)}</section> : null}
          {(displayLanguage === "both" || displayLanguage === "en") && item.bodyEn ? <section lang="en" className="max-w-3xl space-y-5 border-t border-navy/10 pt-7 text-base leading-8 text-navy">{paragraphize(item.bodyEn).map((text, index) => <p key={index} className="whitespace-pre-wrap">{text}</p>)}</section> : null}
        </div>
        {item.imagePaths.length ? <div className="mt-9 grid gap-4 sm:grid-cols-2">{item.imagePaths.map((path) => <img src={mediaUrl(item, path)} alt={title} key={path} className="w-full object-cover" />)}</div> : null}
        {item.quotes.length ? <div className="mt-9 space-y-4 border-l-2 border-brass pl-5">{item.quotes.map((value, index) => <blockquote key={index} className="font-serif text-lg text-navy">{value}</blockquote>)}</div> : null}
        {item.references.length ? <section className="mt-9 border-t border-navy/10 pt-6"><h2 className="font-serif text-xl font-semibold text-navy">{language === "ko" ? "참고자료" : "References"}</h2><ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-muted">{item.references.map((value, index) => <li key={index}>{value}</li>)}</ul></section> : null}
        {item.attachmentPaths.length ? <div className="mt-8 flex flex-wrap gap-2">{item.attachmentPaths.map((path, index) => <a href={mediaUrl(item, path)} key={path} className="inline-flex min-h-10 items-center gap-2 border border-navy/20 px-3 text-sm text-navy"><Download aria-hidden className="h-4 w-4" />{language === "ko" ? `자료 ${index + 1} 내려받기` : `Download file ${index + 1}`} · {path.split(".").pop()?.toUpperCase()}</a>)}</div> : null}
        <div className="mt-9 flex flex-wrap gap-2 border-t border-navy/10 pt-6">{item.tags.map((tag) => <Link href={`${base}?tag=${encodeURIComponent(tag)}`} key={tag} className="bg-hanji px-2 py-1 text-xs text-navy">{tag}</Link>)}</div>
        {item.relatedOrganizationId === "hanhwal" || item.authorOrganization.toLowerCase() === "hanhwal" ? <Link href="/our-activities/hanhwal" className="mt-6 inline-block text-sm font-semibold text-navy underline">Research by HANHWAL</Link> : null}
        {item.relatedActivityId ? <p className="mt-4 text-sm text-muted">{language === "ko" ? "관련 활동" : "Related activity"}: {item.relatedActivityId}</p> : null}
      </>}
    </div>
  </article>;
}
