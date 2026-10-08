"use client";

import Link from "next/link";
import { ArrowLeft, FileArchive, FileImage, FileMusic, FileText, FileVideo, Presentation, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { filterResources, maxResourceBytes, resourceCategories, resourceCategoryLabel, resourceMime, type EccResource, type ResourceCategory } from "@/lib/eccResources/model";

const base = "/our-activities/ecc/resources";
const supported = ".pdf,.ppt,.pptx,.doc,.docx,.hwp,.hwpx,.odt,.odp,.ods,.rtf,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.zip,.mp4,.mp3";
const standardUploadLimit = 6 * 1024 * 1024;

async function uploadSignedFile(url: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const response = await fetch(url, { method: "PUT", headers: { "x-upsert": "false" }, body });
  if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);
}

function iconFor(resource: EccResource) {
  if (resource.mimeType.startsWith("image/")) return FileImage;
  if (resource.mimeType.startsWith("video/")) return FileVideo;
  if (resource.mimeType.startsWith("audio/")) return FileMusic;
  if (resource.mimeType.includes("presentation") || resource.mimeType.includes("powerpoint")) return Presentation;
  if (resource.mimeType === "application/zip") return FileArchive;
  return FileText;
}

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function EccResourceLibrary({ canUpload }: { canUpload: boolean }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [resources, setResources] = useState<EccResource[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | "all">("all");
  const [category, setCategory] = useState<ResourceCategory>("other");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const response = await fetch("/api/ecc/resources", { cache: "no-store" });
      const data = await response.json() as { resources?: EccResource[]; error?: string };
      if (!response.ok || !data.resources) throw new Error(data.error || "Resources are unavailable.");
      setResources(data.resources);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Resources are unavailable."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => filterResources(resources, query, categoryFilter), [resources, query, categoryFilter]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    const mimeType = resourceMime(file.name);
    if (!mimeType || file.size < 1 || file.size > maxResourceBytes) {
      setError(ko ? "지원하는 형식의 50MB 이하 파일을 선택해 주세요." : "Choose a supported file up to 50 MB.");
      return;
    }
    setBusy(true); setError("");
    try {
      const init = await fetch("/api/ecc/resources", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, fileName: file.name, mimeType, sizeBytes: file.size })
      });
      const ticket = await init.json() as { id?: string; storagePath?: string; uploadToken?: string; uploadEndpoint?: string; signedUrl?: string; mimeType?: string; error?: string };
      if (!init.ok || !ticket.id || !ticket.storagePath || !ticket.uploadToken || !ticket.uploadEndpoint || !ticket.signedUrl || !ticket.mimeType) {
        throw new Error(ticket.error || "Upload could not start.");
      }
      if (file.size <= standardUploadLimit) {
        await uploadSignedFile(ticket.signedUrl, file);
      } else {
        const tus = await import("tus-js-client");
        try {
          await new Promise<void>((resolve, reject) => {
            const upload = new tus.Upload(file, {
              endpoint: ticket.uploadEndpoint,
              headers: { "x-signature": ticket.uploadToken! },
              uploadDataDuringCreation: true,
              removeFingerprintOnSuccess: true,
              retryDelays: [0, 3000, 5000, 10000],
              chunkSize: 6 * 1024 * 1024,
              metadata: {
                bucketName: "ecc-resource-library",
                objectName: ticket.storagePath!,
                contentType: ticket.mimeType!,
                cacheControl: "3600"
              },
              onError: reject,
              onSuccess: () => resolve()
            });
            upload.start();
          });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("Invalid Compact JWS")) throw error;
          await uploadSignedFile(ticket.signedUrl, file);
        }
      }
      const complete = await fetch(`/api/ecc/resources/${ticket.id}/publish`, { method: "POST" });
      const result = await complete.json() as { resource?: EccResource; error?: string };
      if (!complete.ok || !result.resource) throw new Error(result.error || "Upload could not be published.");
      setResources((current) => [result.resource!, ...current]);
      setFile(null); setTitle(""); setDescription(""); setCategory("other");
      const input = document.getElementById("ecc-resource-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); }
  };

  return <section className="bg-paper px-4 py-8 sm:px-6 sm:py-12 md:py-16">
    <div className="mx-auto max-w-6xl">
      <Link href="/ecc-official" className="inline-flex items-center gap-2 text-sm font-semibold text-navy"><ArrowLeft aria-hidden className="h-4 w-4" />{ko ? "ECC로 돌아가기" : "Back to ECC"}</Link>
      <header className="mt-7 border-b border-navy/15 pb-7">
        <p className="text-xs font-bold uppercase text-brass">ECC RESOURCE LIBRARY</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-navy sm:text-4xl">{ko ? "ECC 통합자료실" : "ECC Resource Library"}</h1>
        <p className="mt-3 text-sm leading-7 text-muted sm:text-base">{ko ? "ECC의 사진, 발표자료, 문서와 기타 공유 자료를 열람하고 다운로드할 수 있습니다." : "Browse and download ECC photos, presentations, documents, and shared files."}</p>
      </header>

      {canUpload ? <form onSubmit={submit} className="mt-7 grid gap-4 border-b border-navy/15 pb-8">
        <h2 className="font-serif text-xl font-semibold text-navy">{ko ? "자료 업로드" : "Upload a file"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-navy">{ko ? "제목" : "Title"}<input required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className="form-field !rounded-md" /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-navy">{ko ? "파일" : "File"}<input id="ecc-resource-file" required type="file" accept={supported} onChange={(event) => { const chosen = event.target.files?.[0] || null; setFile(chosen); if (chosen && !title) setTitle(chosen.name.replace(/\.[^.]+$/, "")); }} className="form-field !rounded-md" /></label>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold text-navy sm:max-w-sm">{ko ? "자료 분류" : "Category"}<select value={category} onChange={(event) => setCategory(event.target.value as ResourceCategory)} className="form-field !rounded-md">{resourceCategories.map((item) => <option key={item.id} value={item.id}>{ko ? item.ko : item.en}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm font-semibold text-navy">{ko ? "설명" : "Description"}<textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="form-field !rounded-md" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">PDF, PPT, DOC, HWP, XLS, JPG, PNG, ZIP, MP4, MP3 {ko ? "등 · 최대 50MB" : "and more · Up to 50 MB"}</p>
          <button type="submit" disabled={busy || !file} className="inline-flex min-h-11 items-center gap-2 bg-navy px-5 text-sm font-semibold text-white disabled:opacity-50"><Upload aria-hidden className="h-4 w-4" />{busy ? (ko ? "업로드 중…" : "Uploading…") : (ko ? "자료 올리기" : "Upload")}</button>
        </div>
      </form> : null}

      <div className="mt-7 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto]">
        <label className="relative block w-full"><span className="sr-only">{ko ? "자료 검색" : "Search resources"}</span><Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/50" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ko ? "제목, 설명 또는 파일명 검색" : "Search title, description, or file name"} className="form-field !min-h-11 !rounded-md !pl-10" /></label>
        <label className="grid gap-1.5 text-sm font-semibold text-navy"><span className="sr-only">{ko ? "분류별 보기" : "Filter by category"}</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ResourceCategory | "all")} className="form-field !min-h-11 !rounded-md"><option value="all">{ko ? "전체 자료" : "All resources"}</option>{resourceCategories.map((item) => <option key={item.id} value={item.id}>{ko ? item.ko : item.en}</option>)}</select></label>
        <span role="status" className="text-sm text-muted sm:pb-3">{shown.length} {ko ? "건" : "files"}</span>
      </div>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-8 text-sm text-muted">{ko ? "자료를 불러오는 중…" : "Loading resources…"}</p>
        : error ? null : shown.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((resource) => {
          const Icon = iconFor(resource);
          return <Link key={resource.id} href={`${base}/${resource.id}`} className="grid gap-3 rounded-md border border-navy/10 bg-white p-4 transition hover:border-brass/70 hover:shadow-sm">
            {resource.mimeType.startsWith("image/") ? <img src={`/api/ecc/resources/${resource.id}/file`} alt={resource.title} className="aspect-[16/10] w-full object-cover" /> : <div className="flex aspect-[16/10] items-center justify-center bg-hanji"><Icon aria-hidden className="h-9 w-9 text-navy" /></div>}
            <div className="min-w-0"><p className="mb-1 text-xs font-semibold text-brass">{resourceCategoryLabel(resource.category, ko ? "ko" : "en")}</p><h2 className="line-clamp-2 font-serif text-lg font-semibold text-navy">{resource.title}</h2><p className="mt-1 truncate text-xs text-muted">{resource.fileName} · {sizeLabel(resource.sizeBytes)}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{resource.description}</p><p className="mt-3 text-xs text-muted">{resource.uploaderName || "ECC"} · {new Date(resource.publishedAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}</p></div>
          </Link>;
        })}</div> : <p className="mt-8 border-t border-navy/10 py-12 text-center text-sm text-muted">{ko ? "표시할 자료가 없습니다." : "No resources to display."}</p>}
      <div className="mt-7"><a href="/our-activities/ecc/free-board" className="text-xs text-muted underline">{ko ? "이전 게시글 보기" : "View earlier board posts"}</a></div>
    </div>
  </section>;
}
