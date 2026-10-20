"use client";

import Link from "next/link";
import { resourceError } from "@/lib/clubResources/errors";
import { ArrowLeft, Download, ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { canPreviewResource, normalizeResourceCategory, categoriesFor, resourceCategoryLabel, type EccResource, type ResourceCategory, type ResourceClub } from "@/lib/clubResources/model";



export function ClubResourceDetail({ id, isAdmin, club = "ecc" }: { id: string; isAdmin: boolean; club?: ResourceClub }) {
  const base = `/our-activities/${club}/resources`, api = `/api/${club}/resources`;
  const label = club === "hanhwal" ? "한활" : "ECC", english = club === "hanhwal" ? "Hanhwal" : "ECC";
  const resourceCategories = categoriesFor(club);
  const { language } = useLanguage();
  const ko = language === "ko";
  const [resource, setResource] = useState<EccResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingCategory, setEditingCategory] = useState(false);
  const [category, setCategory] = useState<ResourceCategory>("other");
  const [categorySaved, setCategorySaved] = useState(false);
  const [editTitle, setEditTitle] = useState(""), [editDescription, setEditDescription] = useState("");
  const [visibility, setVisibility] = useState("public");

  useEffect(() => {
    let active = true;
    setResource(null); setLoading(true); setError("");
    fetch(`${api}/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { resource?: EccResource; error?: string };
        if (!response.ok || !data.resource) throw new Error(data.error || "File not found.");
        if (active) { setResource(data.resource); setCategory(normalizeResourceCategory(data.resource.category, club)); }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "File not found."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, club]);

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setCategorySaved(false);
    try {
      const response = await fetch(`${api}/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(club === "hanhwal" ? { category, title:editTitle, description:editDescription, visibility, revision:resource?.revision } : { category })
      });
      const data = await response.json() as { resource?: EccResource };
      if (!response.ok || !data.resource) throw new Error(ko ? "자료 분류를 저장하지 못했습니다. 다시 시도해 주세요." : "Category could not be saved. Please try again.");
      setResource(data.resource); setCategory(normalizeResourceCategory(data.resource.category, club));
      setEditingCategory(false); setCategorySaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Category update failed."); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!resource || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/${id}/approve`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:resource.revision})});
      const data = await response.json();
      if (!response.ok || !data.resource) throw new Error(ko ? "승인하지 못했습니다. 자료를 새로 확인해주세요." : "Approval failed. Refresh the resource.");
      setResource(data.resource);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Approval failed."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(ko ? "이 자료를 삭제하시겠습니까?" : "Delete this file?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(ko ? "삭제하지 못했습니다." : "Delete failed.");
      window.location.href = base;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Delete failed."); setBusy(false); }
  };

  const fileUrl = `${api}/${id}/file`;
  return <section className={`${club === "hanhwal" ? "hanhwal-resource-theme bg-white" : "bg-paper"} px-4 py-8 sm:px-6 sm:py-12 md:py-16`}><div className="mx-auto max-w-4xl">
    <Link href={base} className="inline-flex items-center gap-2 text-sm font-semibold text-navy"><ArrowLeft aria-hidden className="h-4 w-4" />{ko ? `${label} 통합자료실` : `${english} Resource Library`}</Link>
    {loading ? <p className="mt-8 text-sm text-muted">{ko ? "자료를 불러오는 중…" : "Loading file…"}</p> : null}
    {error ? <p role="alert" className="mt-8 text-sm text-red-700">{resourceError(new Error(error), ko)}</p> : null}
    {resource ? <article>
      <div className="mt-8 border-b border-navy/15 pb-6">
        <p className="text-xs font-bold uppercase text-brass">{resource.fileName.split(".").pop()?.toUpperCase()} · {english}</p>
        {club === "hanhwal" && <p className="mt-2 text-sm font-semibold">{resource.status === "pending" ? (ko ? "검토 대기" : "Awaiting review") : resource.visibility === "staff" ? (ko ? "운영진 전용" : "Staff only") : resource.visibility === "members" ? (ko ? "회원 전용" : "Members only") : (ko ? "공개 승인" : "Approved public")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-brass">{resourceCategoryLabel(resource.category, ko ? "ko" : "en", club)}</span>
          {isAdmin && !editingCategory ? <button type="button" aria-label={ko ? "분류 변경" : "Change category"} title={ko ? "분류 변경" : "Change category"} disabled={busy} onClick={() => { setCategory(normalizeResourceCategory(resource.category, club)); setEditTitle(resource.title); setEditDescription(resource.description); setVisibility(resource.visibility || "public"); setEditingCategory(true); setCategorySaved(false); }} className="inline-flex h-11 w-11 items-center justify-center text-navy disabled:opacity-50"><Pencil aria-hidden className="h-4 w-4" /></button> : null}
          {categorySaved ? <span role="status" className="text-xs text-muted">{ko ? "분류 저장됨" : "Category saved"}</span> : null}
        </div>
        {isAdmin && editingCategory ? <form onSubmit={saveCategory} className="mt-3 flex flex-wrap items-end gap-2">
          {club === "hanhwal" && <div className="grid w-full gap-3">
            <label className="grid gap-1 text-sm">{ko ? "제목" : "Title"}<input required maxLength={180} className="form-field" value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label>
            <label className="grid gap-1 text-sm">{ko ? "설명" : "Description"}<textarea maxLength={2000} className="form-field" value={editDescription} onChange={e=>setEditDescription(e.target.value)}/></label>
            <label className="grid gap-1 text-sm">{ko ? "공개 범위" : "Visibility"}<select className="form-field" value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="public">{ko ? "공개" : "Public"}</option><option value="members">{ko ? "회원 전용" : "Members only"}</option><option value="staff">{ko ? "운영진 전용" : "Staff only"}</option></select></label>
          </div>}
          <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-semibold text-navy sm:max-w-sm">{ko ? "자료 분류" : "Category"}<select disabled={busy} value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory)} className="form-field !rounded-md">{resourceCategories.map((item) => <option key={item.id} value={item.id}>{ko ? item.ko : item.en}</option>)}</select></label>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 bg-navy px-3 text-sm font-semibold text-white disabled:opacity-50"><Save aria-hidden className="h-4 w-4" />{ko ? "저장" : "Save"}</button>
          <button type="button" disabled={busy} aria-label={ko ? "분류 편집 취소" : "Cancel category edit"} title={ko ? "분류 편집 취소" : "Cancel category edit"} onClick={() => setEditingCategory(false)} className="inline-flex h-11 w-11 items-center justify-center text-navy disabled:opacity-50"><X aria-hidden className="h-4 w-4" /></button>
        </form> : null}
        <h1 className="mt-3 font-serif text-3xl font-semibold text-navy sm:text-4xl">{resource.title}</h1>
        <p className="mt-3 text-sm text-muted">{resource.fileName} · {resource.uploaderName || english} · {new Date(resource.publishedAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}</p>
        {resource.description ? <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-navy">{resource.description}</p> : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {club === "hanhwal" && isAdmin && resource.status === "pending" && <button type="button" disabled={busy} onClick={approve} className="inline-flex min-h-11 items-center gap-2 bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50">{ko ? "검토 승인" : "Approve"}</button>}
        <a href={`${fileUrl}?download=1`} className="inline-flex min-h-11 items-center gap-2 bg-navy px-4 text-sm font-semibold text-white"><Download aria-hidden className="h-4 w-4" />{ko ? "다운로드" : "Download"}</a>
        {canPreviewResource(resource.mimeType) ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 border border-navy/20 px-4 text-sm font-semibold text-navy"><ExternalLink aria-hidden className="h-4 w-4" />{ko ? "새 창에서 보기" : "Open file"}</a> : null}
        {isAdmin ? <button type="button" onClick={remove} disabled={busy} className="inline-flex min-h-11 items-center gap-2 border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50"><Trash2 aria-hidden className="h-4 w-4" />{ko ? "삭제" : "Delete"}</button> : null}
      </div>
      {resource.mimeType.startsWith("image/") ? <img src={fileUrl} alt={resource.title} className="mt-8 max-h-[70vh] w-full object-contain" /> : null}
      {resource.mimeType === "application/pdf" || resource.mimeType.startsWith("text/") ? <p className="mt-8 border-t border-navy/10 py-8 text-sm text-muted">{ko ? "새 창에서 보기로 파일을 열거나 다운로드할 수 있습니다." : "Open the file in a new tab or download it."}</p> : null}
      {resource.mimeType === "video/mp4" ? <video src={fileUrl} controls className="mt-8 w-full" /> : null}
      {resource.mimeType === "audio/mpeg" ? <audio src={fileUrl} controls className="mt-8 w-full" /> : null}
      {!canPreviewResource(resource.mimeType) ? <p className="mt-8 border-t border-navy/10 py-8 text-sm text-muted">{ko ? "이 형식은 브라우저 미리보기를 지원하지 않습니다. 다운로드하여 열어주세요." : "This file type does not support an in-browser preview. Download it to open."}</p> : null}
    </article> : null}
  </div></section>;
}
