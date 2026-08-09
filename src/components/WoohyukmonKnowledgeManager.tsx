"use client";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileArchive,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { createSHA256 } from "hash-wasm";
import * as tus from "tus-js-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { KnowledgeFileRow, KnowledgeSearchResult, KnowledgeStatus } from "@/lib/knowledge/types";

type FileListResponse = {
  files: KnowledgeFileRow[];
  summary: { failed: number; processing: number; queued: number; ready: number; total: number; unsupported: number };
  error?: string;
};

type UploadItem = {
  error: string;
  file: File;
  id: string;
  progress: number;
  status: "hashing" | "preparing" | "uploading" | "processing" | "ready" | "unsupported" | "duplicate" | "failed";
};

type DetailResponse = {
  chunks: Array<{ id: string; chunk_index: number; content: string; page_number: number | null; section: string | null; embedding_provider: string | null; embedding_model: string | null }>;
  entities: Array<{ relation_type: string; confidence: number; source_text: string; knowledge_entities: { entity_type: string; canonical_name: string; aliases: string[] } | null }>;
  file: KnowledgeFileRow;
  jobs: Array<{ id: string; stage: string; status: string; error: string | null; started_at: string; completed_at: string | null }>;
  previewUrl: string;
  relatedFiles: KnowledgeFileRow[];
};

const emptySummary = { failed: 0, processing: 0, queued: 0, ready: 0, total: 0, unsupported: 0 };
const processingStatuses = new Set<KnowledgeStatus>(["EXTRACTING", "ANALYZING", "CHUNKING", "EMBEDDING", "INDEXING"]);

async function responseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function sha256File(file: File) {
  const hasher = await createSHA256();
  const chunkSize = 4 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer();
    hasher.update(new Uint8Array(chunk));
  }
  return hasher.digest();
}

function uploadToSignedUrl(file: File, signedUrl: string, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Storage upload failed (${request.status}).`));
    });
    request.addEventListener("error", () => reject(new Error("Storage upload connection failed.")));
    request.send(file);
  });
}

function uploadResumable(input: {
  file: File;
  onProgress: (value: number) => void;
  path: string;
  token: string;
  url: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(input.file, {
      chunkSize: 6 * 1024 * 1024,
      endpoint: input.url,
      headers: { "x-signature": input.token },
      metadata: {
        bucketName: "woohyukmon-knowledge",
        cacheControl: "3600",
        contentType: input.file.type || "application/octet-stream",
        objectName: input.path
      },
      onError: (error) => reject(error),
      onProgress: (uploaded, total) => input.onProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: KnowledgeStatus | UploadItem["status"]) {
  const labels: Record<string, string> = {
    ANALYZING: "분석 중", CHUNKING: "청킹 중", EMBEDDING: "임베딩 중", EXTRACTING: "추출 중",
    FAILED: "오류", INDEXING: "색인 중", QUEUED: "분석 대기", READY: "분석 완료", UNSUPPORTED: "분석 미지원", UPLOADED: "업로드 완료",
    duplicate: "동일 파일", failed: "오류", hashing: "중복 확인", preparing: "업로드 준비", processing: "분석 중", ready: "완료", unsupported: "분석 미지원", uploading: "업로드 중"
  };
  return labels[status] || status;
}

function fileIcon(file: Pick<KnowledgeFileRow, "mime_type" | "extension">) {
  if (file.mime_type.startsWith("image/")) return ImageIcon;
  if (file.extension === "zip") return FileArchive;
  return FileText;
}

export function WoohyukmonKnowledgeManager() {
  const [files, setFiles] = useState<KnowledgeFileRow[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500", status: filter });
      if (query.trim()) params.set("query", query.trim());
      const data = await responseJson<FileListResponse>(await fetch(`/api/woohyukmon/knowledge/files?${params}`));
      setFiles(data.files ?? []);
      setSummary(data.summary ?? emptySummary);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "자료 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  useEffect(() => {
    const fileId = new URLSearchParams(window.location.search).get("file");
    if (fileId) void loadDetail(fileId);
    // The source deep-link is read only once when this developer tool opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchUploadItem = (id: string, patch: Partial<UploadItem>) => {
    setUploadItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const processOneFile = async (item: UploadItem) => {
    try {
      patchUploadItem(item.id, { status: "hashing" });
      const sha256 = await sha256File(item.file);
      patchUploadItem(item.id, { status: "preparing" });
      const extension = (item.file.name.split(".").pop() || "").toLowerCase();
      const prepared = await responseJson<{
        duplicate: boolean;
        file: KnowledgeFileRow;
        resumableUrl?: string;
        signedUrl?: string;
        token?: string;
      }>(await fetch("/api/woohyukmon/knowledge/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension,
          mimeType: item.file.type || "application/octet-stream",
          name: item.file.name,
          sha256,
          sizeBytes: item.file.size
        })
      }));
      if (prepared.duplicate) {
        patchUploadItem(item.id, { progress: 100, status: "duplicate" });
        return;
      }
      if (!prepared.signedUrl) throw new Error("Signed upload URL is missing.");
      patchUploadItem(item.id, { status: "uploading" });
      const onProgress = (progress: number) => patchUploadItem(item.id, { progress });
      if (item.file.size > 6 * 1024 * 1024 && prepared.resumableUrl && prepared.token) {
        await uploadResumable({
          file: item.file,
          onProgress,
          path: prepared.file.storage_path,
          token: prepared.token,
          url: prepared.resumableUrl
        });
      } else {
        await uploadToSignedUrl(item.file, prepared.signedUrl, onProgress);
      }
      patchUploadItem(item.id, { progress: 100, status: "processing" });
      const processResponse = await fetch(`/api/woohyukmon/knowledge/files/${prepared.file.id}/process`, { method: "POST" });
      const processData = (await processResponse.json()) as { error?: string; file?: KnowledgeFileRow };
      if (processResponse.status === 422) {
        patchUploadItem(item.id, { error: processData.error || "원본 저장 완료 / 현재 분석 미지원", status: "unsupported" });
        return;
      }
      if (!processResponse.ok) throw new Error(processData.error || "파일 분석에 실패했습니다.");
      patchUploadItem(item.id, { status: "ready" });
    } catch (requestError) {
      patchUploadItem(item.id, {
        error: requestError instanceof Error ? requestError.message : "업로드에 실패했습니다.",
        status: "failed"
      });
    }
  };

  const enqueueFiles = async (selected: File[]) => {
    const items = selected.map((file) => ({
      error: "",
      file,
      id: crypto.randomUUID(),
      progress: 0,
      status: "hashing" as const
    }));
    setUploadItems((current) => [...items, ...current].slice(0, 2000));
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await processOneFile(items[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, () => worker()));
    await loadFiles();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void enqueueFiles(Array.from(event.dataTransfer.files));
  };

  const loadDetail = async (fileId: string) => {
    setSelectedId(fileId);
    setDetailLoading(true);
    try {
      setDetail(await responseJson<DetailResponse>(await fetch(`/api/woohyukmon/knowledge/files/${fileId}`)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "상세 정보를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const reprocessFile = async (fileId: string) => {
    setDetailLoading(true);
    try {
      await responseJson(await fetch(`/api/woohyukmon/knowledge/files/${fileId}/process`, { method: "POST" }));
      await Promise.all([loadFiles(), loadDetail(fileId)]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "재분석에 실패했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const deleteFile = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await responseJson(await fetch(`/api/woohyukmon/knowledge/files/${pendingDelete.id}`, { method: "DELETE" }));
      setPendingDelete(null);
      setSelectedId("");
      setDetail(null);
      await loadFiles();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await responseJson<{ results: KnowledgeSearchResult[] }>(await fetch("/api/woohyukmon/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 12, query: searchQuery.trim() })
      }));
      setSearchResults(data.results ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const activeUploads = useMemo(() => uploadItems.filter((item) => !["ready", "unsupported", "duplicate", "failed"].includes(item.status)).length, [uploadItems]);

  return (
    <main className="min-h-screen bg-[#111719] text-[#f5f0e6]">
      <section className="border-b border-white/10 bg-[#151d20] py-10 md:py-14">
        <div className="mx-auto max-w-[1500px] px-5 md:px-8">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#d6a85a]"><BrainCircuit className="h-5 w-5" />개발자 전용</div>
          <h1 className="mt-3 text-4xl font-semibold md:text-6xl">우혁몬 교육</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62 md:text-base">WooHyukmon이 참고할 자료를 업로드하고 관리합니다. 파일을 정리하지 않아도 원본 저장, 분석, 분류, 검색 가능한 지식 변환을 순서대로 처리합니다.</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 md:px-8 md:py-10">
        {error ? <div className="flex items-start gap-3 border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError("")} aria-label="오류 닫기"><X className="h-4 w-4" /></button></div> : null}

        <section className="border border-white/10 bg-white/[0.035] p-4 md:p-6">
          <div
            className={`flex min-h-64 flex-col items-center justify-center border border-dashed p-7 text-center transition ${dragging ? "border-[#d6a85a] bg-[#d6a85a]/10" : "border-white/20 bg-black/10 hover:border-white/40"}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={handleDrop}
          >
            <UploadCloud className="h-11 w-11 text-[#d6a85a]" />
            <h2 className="mt-5 text-xl font-semibold">파일을 이곳에 끌어다 놓으세요</h2>
            <p className="mt-2 text-sm leading-6 text-white/52">PDF · Office · HWP · TXT · CSV · 이미지 · ZIP · 기타 파일을 원본 그대로 보존합니다.</p>
            <button onClick={() => fileInputRef.current?.click()} className="mt-5 inline-flex h-11 items-center justify-center bg-[#d6a85a] px-5 text-sm font-semibold text-[#121718] transition hover:bg-[#e3ba72]">파일 선택</button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { const selected = Array.from(event.target.files ?? []); event.target.value = ""; void enqueueFiles(selected); }} />
          </div>

          {uploadItems.length > 0 ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">이번 업로드</h3><span className="text-xs text-white/45">처리 중 {activeUploads} / 전체 {uploadItems.length}</span></div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {uploadItems.map((item) => (
                  <div key={item.id} className="border border-white/10 bg-black/15 p-3">
                    <div className="flex items-center gap-3 text-sm"><FileText className="h-4 w-4 shrink-0 text-white/45" /><span className="min-w-0 flex-1 truncate">{item.file.name}</span><span className="shrink-0 text-xs font-semibold text-[#d6a85a]">{statusLabel(item.status)}</span></div>
                    <div className="mt-2 h-1.5 overflow-hidden bg-white/8"><div className="h-full bg-[#6b8f71] transition-all" style={{ width: `${item.status === "processing" ? 100 : item.progress}%` }} /></div>
                    {item.error ? <p className="mt-2 text-xs text-red-200">{item.error}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="총 파일" value={summary.total} icon={Database} />
          <Metric label="분석 완료" value={summary.ready} icon={CheckCircle2} />
          <Metric label="처리 중" value={summary.processing} icon={LoaderCircle} />
          <Metric label="분석 대기" value={summary.queued} icon={RefreshCw} />
          <Metric label="미지원" value={summary.unsupported} icon={FileArchive} />
          <Metric label="오류" value={summary.failed} icon={AlertTriangle} />
        </section>

        <section className="border border-white/10 bg-white/[0.035] p-4 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[#d6a85a]">Semantic retrieval</p><h2 className="mt-1 text-2xl font-semibold">우혁몬 DB 검색</h2></div><p className="text-sm text-white/45">파일명, 본문, AI 설명, 조직·행사 맥락을 함께 검색합니다.</p></div>
          <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void runSearch(); }}><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="예: ECC MT 때 완주에서 찍은 사진" className="h-12 min-w-0 flex-1 border border-white/15 bg-[#0d1214] px-4 text-sm outline-none focus:border-[#d6a85a]" /><button disabled={searching} className="flex h-12 w-12 items-center justify-center bg-[#d6a85a] text-[#121718] disabled:opacity-50" aria-label="우혁몬 DB 검색">{searching ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}</button></form>
          {searchResults.length > 0 ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{searchResults.map((result) => <button key={result.chunkId} onClick={() => void loadDetail(result.fileId)} className="border border-white/10 bg-black/15 p-4 text-left transition hover:border-[#d6a85a]/60"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{result.fileName}</p><span className="text-xs text-[#d6a85a]">{Math.round(result.score * 100)}%</span></div><p className="mt-2 line-clamp-3 text-sm leading-6 text-white/58">{result.content}</p><p className="mt-3 text-xs text-white/38">{[result.organization, result.event, result.location, result.pageNumber ? `p.${result.pageNumber}` : ""].filter(Boolean).join(" · ")}</p></button>)}</div> : null}
        </section>

        <section className="border border-white/10 bg-white/[0.035] p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-[#d6a85a]">Knowledge files</p><h2 className="mt-1 text-2xl font-semibold">업로드 자료</h2></div><button onClick={() => void loadFiles()} className="inline-flex h-10 items-center gap-2 border border-white/15 px-3 text-sm hover:bg-white/5"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />새로고침</button></div>
          <div className="mt-5 flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="파일명 또는 요약 검색" className="h-10 w-full border border-white/15 bg-[#0d1214] pl-10 pr-3 text-sm outline-none focus:border-[#d6a85a]" /></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 border border-white/15 bg-[#0d1214] px-3 text-sm"><option value="ALL">전체 상태</option><option value="READY">READY</option><option value="PROCESSING">PROCESSING</option><option value="FAILED">FAILED</option><option value="UNSUPPORTED">UNSUPPORTED</option></select></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="border-y border-white/10 text-xs uppercase text-white/38"><tr><th className="px-3 py-3">파일</th><th className="px-3 py-3">크기</th><th className="px-3 py-3">상태</th><th className="px-3 py-3">자동 분류</th><th className="px-3 py-3">업로드</th><th className="px-3 py-3">오류</th></tr></thead><tbody>{files.map((file) => { const Icon = fileIcon(file); return <tr key={file.id} onClick={() => void loadDetail(file.id)} className="cursor-pointer border-b border-white/8 transition hover:bg-white/[0.04]"><td className="px-3 py-3"><span className="flex items-center gap-3"><Icon className="h-4 w-4 shrink-0 text-[#d6a85a]" /><span><span className="block max-w-sm truncate font-medium">{file.original_name}</span><span className="text-xs text-white/35">{file.extension.toUpperCase() || "FILE"} · {file.mime_type}</span></span></span></td><td className="px-3 py-3 text-white/55">{formatBytes(file.size_bytes)}</td><td className="px-3 py-3"><StatusBadge status={file.processing_status} /></td><td className="px-3 py-3 text-white/55">{[file.organization, file.event].filter((value) => value && value !== "UNKNOWN").join(" · ") || "분류 대기"}</td><td className="px-3 py-3 text-white/45">{formatDate(file.uploaded_at)}</td><td className="max-w-xs truncate px-3 py-3 text-xs text-red-200/75">{file.processing_error || "-"}</td></tr>; })}</tbody></table>{!loading && files.length === 0 ? <p className="py-12 text-center text-sm text-white/42">조건에 맞는 자료가 없습니다.</p> : null}</div>
        </section>
      </div>

      {selectedId ? <DetailPanel detail={detail} loading={detailLoading} onClose={() => { setSelectedId(""); setDetail(null); }} onDelete={(id, name) => setPendingDelete({ id, name })} onReprocess={reprocessFile} /> : null}
      {pendingDelete ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-5" role="alertdialog" aria-modal="true" aria-labelledby="delete-knowledge-title"><div className="w-full max-w-md border border-red-400/25 bg-[#141b1e] p-6 shadow-2xl"><div className="flex h-11 w-11 items-center justify-center bg-red-400/10 text-red-200"><AlertTriangle className="h-5 w-5" /></div><h2 id="delete-knowledge-title" className="mt-5 text-xl font-semibold">자료를 삭제할까요?</h2><p className="mt-3 break-words text-sm leading-6 text-white/60"><strong className="text-white/85">{pendingDelete.name}</strong> 원본과 분석 데이터를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p><div className="mt-6 flex justify-end gap-2"><button disabled={deleting} onClick={() => setPendingDelete(null)} className="h-10 border border-white/15 px-4 text-sm disabled:opacity-50">취소</button><button disabled={deleting} onClick={() => void deleteFile()} className="inline-flex h-10 items-center gap-2 bg-red-500 px-4 text-sm font-semibold text-white disabled:opacity-50">{deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}삭제 확인</button></div></div></div> : null}
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) {
  return <div className="border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-white/42">{label}</p><Icon className="h-4 w-4 text-[#d6a85a]" /></div><p className="mt-4 text-3xl font-semibold">{value}</p></div>;
}

function StatusBadge({ status }: { status: KnowledgeStatus }) {
  const color = status === "READY" ? "bg-emerald-400/12 text-emerald-200" : status === "FAILED" ? "bg-red-400/12 text-red-200" : status === "UNSUPPORTED" ? "bg-amber-400/12 text-amber-100" : processingStatuses.has(status) ? "bg-sky-400/12 text-sky-200" : "bg-white/8 text-white/65";
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold ${color}`}>{statusLabel(status)}</span>;
}

function DetailPanel({ detail, loading, onClose, onDelete, onReprocess }: { detail: DetailResponse | null; loading: boolean; onClose: () => void; onDelete: (id: string, name: string) => void; onReprocess: (id: string) => void }) {
  return <div className="fixed inset-0 z-[80] flex justify-end bg-black/65" role="dialog" aria-modal="true"><div className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-[#141b1e] p-5 shadow-2xl md:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">파일 상세</h2><button onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-white/15" aria-label="상세 닫기"><X className="h-4 w-4" /></button></div>{loading || !detail ? <div className="flex min-h-80 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#d6a85a]" /></div> : <div className="mt-6 space-y-6"><div><p className="break-words text-2xl font-semibold">{detail.file.original_name}</p><div className="mt-3 flex flex-wrap gap-2"><StatusBadge status={detail.file.processing_status} /><span className="bg-white/8 px-2 py-1 text-xs text-white/60">{formatBytes(detail.file.size_bytes)}</span><span className="bg-white/8 px-2 py-1 text-xs text-white/60">{detail.file.parser_type || "Parser 대기"}</span></div></div>{detail.previewUrl && detail.file.mime_type.startsWith("image/") ? <img src={detail.previewUrl} alt={detail.file.ai_description || detail.file.original_name} className="max-h-80 w-full object-contain bg-black/25" /> : null}<DetailBlock title="AI Summary"><p>{detail.file.ai_summary || "아직 분석된 요약이 없습니다."}</p></DetailBlock><div className="grid gap-3 sm:grid-cols-2"><DetailValue label="Organization" value={detail.file.organization} /><DetailValue label="Event" value={detail.file.event} /><DetailValue label="Location" value={detail.file.location} /><DetailValue label="Date" value={detail.file.document_date} /><DetailValue label="Document type" value={detail.file.document_type} /><DetailValue label="Confidence" value={detail.file.confidence === null ? "" : `${Math.round(detail.file.confidence * 100)}%`} /></div><DetailBlock title={`Extracted Text · Chunks ${detail.chunks.length}`}><p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-white/55">{detail.file.extracted_text || detail.file.ai_description || "추출된 텍스트가 없습니다."}</p></DetailBlock><DetailBlock title={`Entities ${detail.entities.length}`}><div className="flex flex-wrap gap-2">{detail.entities.length ? detail.entities.map((link) => <span key={`${link.knowledge_entities?.entity_type}-${link.knowledge_entities?.canonical_name}`} className="border border-white/10 px-2 py-1 text-xs text-white/65">{link.knowledge_entities?.entity_type}: {link.knowledge_entities?.canonical_name}</span>) : <p>연결된 Entity가 없습니다.</p>}</div></DetailBlock><DetailBlock title={`관련 파일 ${detail.relatedFiles.length}`}><div className="space-y-2">{detail.relatedFiles.length ? detail.relatedFiles.map((file) => <p key={file.id} className="border-b border-white/8 pb-2 text-xs">{file.original_name} · {file.organization || "UNKNOWN"} · {file.event || "UNKNOWN"}</p>) : <p>자동 연결된 관련 파일이 없습니다.</p>}</div></DetailBlock><DetailBlock title="Processing Log"><div className="space-y-2">{detail.jobs.map((job) => <div key={job.id} className="flex items-start justify-between gap-3 border-b border-white/8 pb-2 text-xs"><span>{job.stage}</span><span className={job.status === "FAILED" ? "text-red-200" : "text-white/45"}>{job.status} · {formatDate(job.started_at)}</span></div>)}</div></DetailBlock>{detail.file.processing_error ? <DetailBlock title="오류 로그"><p className="text-red-200">{detail.file.processing_error}</p></DetailBlock> : null}<div className="flex flex-wrap gap-2 border-t border-white/10 pt-5">{detail.previewUrl ? <a href={detail.previewUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center border border-white/15 px-3 text-sm hover:bg-white/5">원본 열기</a> : null}<button disabled={loading} onClick={() => void onReprocess(detail.file.id)} className="inline-flex h-10 items-center gap-2 border border-[#d6a85a]/50 px-3 text-sm text-[#e7bd72] disabled:opacity-50"><RefreshCw className="h-4 w-4" />재분석</button><button disabled={loading} onClick={() => void onDelete(detail.file.id, detail.file.original_name)} className="ml-auto inline-flex h-10 items-center gap-2 border border-red-400/30 px-3 text-sm text-red-200 disabled:opacity-50"><Trash2 className="h-4 w-4" />삭제</button></div></div>}</div></div>;
}

function DetailBlock({ children, title }: { children: React.ReactNode; title: string }) { return <section className="border border-white/10 bg-black/15 p-4"><h3 className="text-xs font-semibold uppercase text-[#d6a85a]">{title}</h3><div className="mt-3 text-sm leading-7 text-white/65">{children}</div></section>; }
function DetailValue({ label, value }: { label: string; value: string | null }) { return <div className="border border-white/10 bg-black/15 p-3"><p className="text-xs uppercase text-white/35">{label}</p><p className="mt-1 text-sm text-white/72">{value && value !== "UNKNOWN" ? value : "확인되지 않음"}</p></div>; }
