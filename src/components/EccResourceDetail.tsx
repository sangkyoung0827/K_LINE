"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { canPreviewResource, type EccResource } from "@/lib/eccResources/model";

const base = "/our-activities/ecc/resources";

export function EccResourceDetail({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [resource, setResource] = useState<EccResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/ecc/resources/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { resource?: EccResource; error?: string };
        if (!response.ok || !data.resource) throw new Error(data.error || "File not found.");
        if (active) setResource(data.resource);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "File not found."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const remove = async () => {
    if (!window.confirm(ko ? "이 자료를 삭제하시겠습니까?" : "Delete this file?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/ecc/resources/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(ko ? "삭제하지 못했습니다." : "Delete failed.");
      window.location.href = base;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Delete failed."); setBusy(false); }
  };

  const fileUrl = `/api/ecc/resources/${id}/file`;
  return <section className="bg-paper px-4 py-8 sm:px-6 sm:py-12 md:py-16"><div className="mx-auto max-w-4xl">
    <Link href={base} className="inline-flex items-center gap-2 text-sm font-semibold text-navy"><ArrowLeft aria-hidden className="h-4 w-4" />{ko ? "ECC 통합자료실" : "ECC Resource Library"}</Link>
    {loading ? <p className="mt-8 text-sm text-muted">{ko ? "자료를 불러오는 중…" : "Loading file…"}</p> : null}
    {error ? <p role="alert" className="mt-8 text-sm text-red-700">{error}</p> : null}
    {resource ? <article>
      <div className="mt-8 border-b border-navy/15 pb-6">
        <p className="text-xs font-bold uppercase text-brass">{resource.fileName.split(".").pop()?.toUpperCase()} · ECC</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-navy sm:text-4xl">{resource.title}</h1>
        <p className="mt-3 text-sm text-muted">{resource.fileName} · {resource.uploaderName || "ECC"} · {new Date(resource.publishedAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}</p>
        {resource.description ? <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-navy">{resource.description}</p> : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
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
