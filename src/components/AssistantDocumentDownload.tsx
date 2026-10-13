"use client";
import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function AssistantDocumentDownload({ file }: { file: { name: string; url: string } }) {
  const { pick } = useLanguage();
  const busy = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    if (busy.current) return;
    busy.current = true; setDownloading(true); setError("");
    try {
      if (!file.url.startsWith("/api/woohyukmon/club-assistant/export?")) throw new Error("Invalid export URL.");
      const response = await fetch(file.url, { cache: "no-store", referrerPolicy: "no-referrer" });
      const mime = response.headers.get("Content-Type") || "";
      if (!response.ok || !["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].some(type => mime.includes(type))) throw new Error("Export unavailable.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || file.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(pick({ ko: "파일을 내려받지 못했습니다. 권한과 연결을 확인하거나 문서를 다시 요청해 주세요.", en: "Could not download. Check access and connection, or request the document again." }));
    } finally { busy.current = false; setDownloading(false); }
  };
  return <div className="mt-3 grid gap-2">
    <button type="button" onClick={() => void download()} disabled={downloading} aria-busy={downloading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink/15 px-3 text-sm">
      {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{file.name}
    </button>
    {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
  </div>;
}
