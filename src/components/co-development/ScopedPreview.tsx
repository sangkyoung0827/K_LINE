"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Square } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { labApiPath } from "@/lib/coDevelopment/model";

export function ScopedPreview({ id, review = false, ownerDraft = false }: { id: string; review?: boolean; ownerDraft?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [running, setRunning] = useState(true);
  const [run, setRun] = useState(0);
  const [error, setError] = useState("");
  const { language } = useLanguage();
  const ko = language === "ko";
  useEffect(() => {
    if (!running) return;
    let port: MessagePort | null = null, closed = false;
    let queue = Promise.resolve(), count = 0, since = Date.now();
    let state = { data: {} as Record<string, unknown>, version: 0 };
    const records = new Map<string, { id: string; collection: string; data: unknown; version: number; archived: boolean }>();
    const onReady = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== "kline-lab-ready" || port) return;
      const channel = new MessageChannel(); port = channel.port1;
      const active = port;
      port.onmessage = message => {
        const input = message.data;
        if (!input || !Number.isSafeInteger(input.id)) return;
        queue = queue.then(async () => {
          if (closed) return;
          try {
            if (Date.now() - since > 60000) { count = 0; since = Date.now(); }
            if (++count > 60) throw new Error("RATE_LIMITED");
            const action = input.action === "read" ? "state_read" : input.action === "save" ? "state_save" : input.action === "record_create" ? "record_save" : input.action;
            if (!["state_read", "state_save", "records_list", "record_save"].includes(action)) throw new Error("INVALID_OPERATION");
            const payload = { action, collection: input.collection, id: input.action === "record_create" ? crypto.randomUUID() : input.recordId,
              data: input.data, expectedVersion: input.action === "record_create" ? 0 : input.expectedVersion,
              after: input.after, limit: input.limit, includeArchived: input.includeArchived, archived: input.archived };
            let result: unknown;
            if (review || ownerDraft) {
              // Review interactions are ephemeral: never write to the author's lab or live records.
              if (action === "state_read") result = state;
              else if (action === "state_save") {
                if (payload.expectedVersion !== state.version) throw new Error("STATE_CONFLICT");
                state = { data: payload.data, version: state.version + 1 }; result = state;
              } else if (action === "records_list") {
                const all = [...records.values()].filter(r => r.collection === input.collection && (input.includeArchived || !r.archived) && (!input.after || r.id > input.after)).sort((a, b) => a.id.localeCompare(b.id));
                const limit = Math.max(1, Math.min(input.limit || 50, 100));
                result = { records: all.slice(0, limit), nextCursor: all.length > limit ? all[limit - 1].id : null };
              } else {
                const key = `${payload.collection}:${payload.id}`, previous = records.get(key);
                if ((previous?.version || 0) !== payload.expectedVersion) throw new Error("RECORD_CONFLICT");
                if (records.size >= 500 && !previous) throw new Error("PROJECT_LIMIT");
                const record = { id: payload.id!, collection: payload.collection, data: payload.data, version: payload.expectedVersion + 1, archived: payload.archived === true };
                records.set(key, record); result = record;
              }
            } else {
              const response = await fetch(`${labApiPath}/service/${id}/data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
              result = await response.json();
              if (!response.ok) throw new Error(response.status === 401 ? "SIGN_IN_REQUIRED" : (result as { error: string }).error);
            }
            if (!closed) active.postMessage({ id: input.id, result });
          } catch (value) {
            const code = value instanceof Error ? value.message : "LAB_UNAVAILABLE";
            if (code === "SIGN_IN_REQUIRED" && !closed) setError(ko ? "데이터를 저장하려면 로그인해주세요." : "Sign in to save data.");
            if (!closed) active.postMessage({ id: input.id, error: code });
          }
        });
      };
      event.source?.postMessage({ type: "kline-lab-connect" }, { targetOrigin: "*", transfer: [channel.port2] });
    };
    window.addEventListener("message", onReady);
    return () => { closed = true; port?.close(); window.removeEventListener("message", onReady); };
  }, [id, review, ownerDraft, running, run, ko]);
  return <div className="min-w-0 space-y-2">
    <div className="flex justify-end gap-2">
      <button type="button" title={ko ? "다시 실행" : "Restart"} aria-label={ko ? "다시 실행" : "Restart"} className="h-11 w-11 rounded border border-ink/20" onClick={() => { setError(""); setRunning(true); setRun(v => v + 1); }}><RefreshCw className="mx-auto" size={18} /></button>
      <button type="button" title={ko ? "실행 중지" : "Stop"} aria-label={ko ? "실행 중지" : "Stop"} className="h-11 w-11 rounded border border-ink/20" onClick={() => setRunning(false)}><Square className="mx-auto" size={18} /></button>
    </div>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {running && <iframe ref={frame} key={`${id}:${run}`} title={review || ownerDraft ? "Review preview" : "Service preview"} src={`${labApiPath}/${ownerDraft ? "owner-preview" : review ? "review-preview" : "service"}/${id}`} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[70dvh] min-h-80 w-full rounded border border-ink/20 bg-white" />}
  </div>;
}
