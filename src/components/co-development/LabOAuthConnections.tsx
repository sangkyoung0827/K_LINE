"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Unplug } from "lucide-react";
import { labSetupPrompt } from "@/lib/coDevelopment/setup-guide";
type Connection = { id: string; clientName: string; createdAt: string; expiresAt: string };
export function LabOAuthConnections({ ko }: { ko: boolean }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"url" | "setup" | null>(null);
  const endpoint = "/api/co-development/oauth/connections";
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    if (!response.ok) throw new Error();
    const value = await response.json();
    if (!signal?.aborted) setConnections(value);
  }, [endpoint]);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch(() => { if (!abort.signal.aborted) setError(ko ? "연결 정보를 불러오지 못했습니다." : "Could not load connections."); });
    return () => abort.abort();
  }, [ko, load]);
  const button = "inline-flex min-h-11 items-center gap-2 rounded border border-ink/20 px-3 py-2 text-sm font-semibold disabled:opacity-50";
  return <div role="tabpanel" className="space-y-4">
    {window.location.protocol !== "https:" && <p role="status" className="text-sm text-amber-900">{ko ? "로컬 검증 화면입니다. 외부 ChatGPT 연결은 승인된 HTTPS 배포 후 사용할 수 있습니다." : "Local verification only. External ChatGPT linking requires an approved HTTPS deployment."}</p>}
    <label className="grid gap-2 text-sm font-semibold">MCP URL<input readOnly value={`${window.location.origin}/api/co-development/mcp`} className="form-field text-xs" /></label>
    <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { void navigator.clipboard.writeText(labSetupPrompt(window.location.origin, ko ? "ko" : "en")).then(() => setCopied("setup")).catch(() => setError(ko ? "복사하지 못했습니다." : "Could not copy.")); }}>{copied === "setup" ? <Check size={16} /> : <Copy size={16} />}{ko ? "시작 명령 복사" : "Copy start command"}</button><button type="button" className={button} onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/api/co-development/mcp`).then(() => setCopied("url")).catch(() => setError(ko ? "복사하지 못했습니다." : "Could not copy.")); }}>{copied === "url" ? <Check size={16} /> : <Copy size={16} />}{ko ? "주소 복사" : "Copy URL"}</button><span role="status" className="sr-only">{copied === "setup" ? (ko ? "시작 명령을 복사했습니다." : "Start command copied.") : copied === "url" ? (ko ? "주소를 복사했습니다." : "URL copied.") : ""}</span></div>
    <p className="text-sm leading-6">{ko ? "ChatGPT의 MCP 연결에서 OAuth를 선택하고 이 주소를 입력하세요. K_LINE에 본인 계정으로 로그인한 뒤 개발 공간 연결을 허용하세요. 별도 API 키는 필요하지 않습니다." : "Add this MCP URL in ChatGPT with OAuth. Sign in to your own K_LINE account and allow workspace access. No API key is needed."}</p>
    <p className="text-xs text-muted">{ko ? "ChatGPT 계정·워크스페이스에서 사용자 지정 MCP를 허용해야 합니다. 파일 첨부만으로는 연결되지 않습니다." : "Your ChatGPT account/workspace must support custom MCP connections. Attaching a file alone does not connect tools."}</p>
    <div className="border-t border-ink/15 pt-4"><h3 className="text-sm font-semibold">{ko ? "연결된 앱" : "Connected apps"}</h3>
      {!connections.length && !error && <p className="mt-3 text-sm text-muted">{ko ? "연결된 앱이 없습니다." : "No connected apps."}</p>}
      {connections.map(connection => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{connection.clientName}</p><p className="text-xs text-muted">{new Date(connection.createdAt).toLocaleDateString(ko ? "ko-KR" : "en-US")}</p></div><button type="button" disabled={busy} className={button} onClick={() => { setBusy(true); setError(""); void fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: connection.id }) }).then(async response => { if (!response.ok) throw new Error(); await load(); }).catch(() => setError(ko ? "연결을 해제하지 못했습니다." : "Could not disconnect.")).finally(() => setBusy(false)); }}><Unplug size={16} />{ko ? "연결 해제" : "Disconnect"}</button></div>)}
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>;
}
