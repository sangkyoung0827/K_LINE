"use client";

import { Check, Loader2, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";
import type {
  WoohyukmonOperationResponse,
  WoohyukmonTableRow
} from "@/lib/woohyukmon/operations/types";

type GroundingSource = {
  title: string;
  url: string;
};

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  providers?: string[];
  sourceCount?: number;
  sources?: GroundingSource[];
  operation?: Exclude<WoohyukmonOperationResponse, { handled: false }>;
  request?: string;
};

type GeminiEvent = {
  type?: "status" | "text" | "grounding" | "done" | "error";
  label?: string;
  status?: string;
  text?: string;
  error?: string;
  providers?: string[];
  sourceCount?: number;
  groundingChunks?: GroundingSource[];
};

function parseNdjsonLine(line: string): GeminiEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as GeminiEvent;
  } catch {
    return null;
  }
}

function operationText(
  response: Exclude<WoohyukmonOperationResponse, { handled: false }>
) {
  if (response.kind === "candidates") {
    return `${response.title}\n${response.summary}`;
  }

  if (response.kind === "confirmation") {
    return `${response.title}\n${response.summary}`;
  }

  if (response.kind === "result") {
    return `${response.title}\n${response.summary}`;
  }

  return [response.title, response.summary].filter(Boolean).join("\n");
}

function CompactTable({ rows }: { rows: WoohyukmonTableRow[] }) {
  const visibleRows = rows.slice(0, 25);
  const columns = useMemo(
    () => Array.from(new Set(visibleRows.flatMap((row) => Object.keys(row)))),
    [visibleRows]
  );

  if (visibleRows.length === 0 || columns.length === 0) return null;

  return (
    <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-ink/10 bg-white">
      <table className="w-full min-w-[320px] border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-hanji">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap border-b border-ink/10 px-3 py-2 font-semibold text-ink/65"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={index} className="border-b border-ink/5 last:border-b-0">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 align-top text-ink/75">
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visibleRows.length ? (
        <p className="border-t border-ink/10 px-3 py-2 text-[11px] text-ink/50">
          {rows.length - visibleRows.length}건은 화면 복잡도를 줄이기 위해 생략했습니다.
        </p>
      ) : null}
    </div>
  );
}

export function GlobalWoohyukmon({ actorRole }: { actorRole: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [contextTargetId, setContextTargetId] = useState("");
  const [contextTargetIds, setContextTargetIds] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const updateAssistant = (
    id: string,
    updater: (message: UiMessage) => UiMessage
  ) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? updater(message) : message))
    );
  };

  const rememberContext = (
    response: Exclude<WoohyukmonOperationResponse, { handled: false }>
  ) => {
    if (
      (response.kind === "answer" || response.kind === "result") &&
      response.contextTargetId
    ) {
      setContextTargetId(response.contextTargetId);
    }

    if (
      (response.kind === "answer" || response.kind === "result") &&
      response.contextTargetIds
    ) {
      setContextTargetIds(response.contextTargetIds);
      if (response.contextTargetIds.length === 1) {
        setContextTargetId(response.contextTargetIds[0]);
      }
    }
  };

  const callOperations = async (
    requestText: string,
    selectedTargetId = ""
  ) => {
    const response = await fetch("/api/woohyukmon/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: requestText,
        selectedTargetId,
        contextTargetId,
        contextTargetIds
      })
    });

    const data = (await response.json().catch(() => ({}))) as
      | WoohyukmonOperationResponse
      | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "K_LINE 운영 요청을 처리하지 못했습니다."
      );
    }

    return data as WoohyukmonOperationResponse;
  };

  const runGeminiFallback = async (requestText: string) => {
    const assistantId = `assistant-${Date.now()}`;
    let snapshot = "";

    setMessages((current) => [
      ...current,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "우혁몬이 답변을 준비하는 중"
      }
    ]);

    const history = messages
      .filter((message) => message.content.trim())
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 1400)
      }));

    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: requestText,
        history,
        mode: "chat",
        modelVersion: "4",
        localBoardPosts: [],
        attachmentNames: []
      })
    });

    if (!response.ok || !response.body) {
      throw new Error("우혁몬 답변을 생성하지 못했습니다.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseNdjsonLine(line);
        if (!event) continue;

        if (event.type === "error") {
          throw new Error(event.error || "우혁몬 답변 중 오류가 발생했습니다.");
        }

        if (event.type === "status") {
          updateAssistant(assistantId, (message) => ({
            ...message,
            status: event.label || event.status || message.status,
            providers: Array.from(
              new Set([...(message.providers ?? []), ...(event.providers ?? [])])
            ),
            sourceCount:
              typeof event.sourceCount === "number"
                ? event.sourceCount
                : message.sourceCount
          }));
        }

        if (
          (event.type === "grounding" || event.type === "done") &&
          event.groundingChunks
        ) {
          updateAssistant(assistantId, (message) => {
            const sources = [...(message.sources ?? [])];

            event.groundingChunks?.forEach((source) => {
              if (
                source?.url &&
                !sources.some((existing) => existing.url === source.url)
              ) {
                sources.push(source);
              }
            });

            return {
              ...message,
              sources,
              providers: Array.from(
                new Set([...(message.providers ?? []), ...(event.providers ?? [])])
              ),
              sourceCount:
                typeof event.sourceCount === "number"
                  ? event.sourceCount
                  : sources.length
            };
          });
        }

        if (event.type === "text" && event.text) {
          snapshot += event.text.replace(/\*\*/g, "");
          updateAssistant(assistantId, (message) => ({
            ...message,
            content: snapshot,
            status: "우혁몬이 답변 중"
          }));
        }

        if (event.type === "done") {
          updateAssistant(assistantId, (message) => {
            const count = event.sourceCount ?? message.sourceCount ?? message.sources?.length ?? 0;
            const providers = Array.from(
              new Set([...(message.providers ?? []), ...(event.providers ?? [])])
            );

            return {
              ...message,
              providers,
              sourceCount: count,
              status:
                count > 0
                  ? `${providers.join(" · ") || "외부 검색"} 검색 완료 · ${count}개 자료 참고`
                  : "답변 완료"
            };
          });
        }
      }
    }

    if (buffer.trim()) {
      const event = parseNdjsonLine(buffer);
      if (event?.type === "text" && event.text) {
        snapshot += event.text.replace(/\*\*/g, "");
      }
    }

    updateAssistant(assistantId, (message) => ({
      ...message,
      content: snapshot.trim() || "답변을 생성하지 못했습니다. 다시 질문해 주세요.",
      status: "답변 완료"
    }));
  };

  const handleOperationResponse = (
    response: Exclude<WoohyukmonOperationResponse, { handled: false }>,
    requestText: string
  ) => {
    rememberContext(response);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: operationText(response),
        operation: response,
        request: requestText
      }
    ]);
  };

  const send = async (
    requestText: string,
    options?: { silentUser?: boolean; selectedTargetId?: string }
  ) => {
    const trimmed = requestText.trim();
    if (!trimmed || busy) return;

    if (!options?.silentUser) {
      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed
        }
      ]);
      setInput("");
    }

    setBusy(true);

    try {
      const operationResponse = await callOperations(
        trimmed,
        options?.selectedTargetId || ""
      );

      if (operationResponse.handled) {
        handleOperationResponse(operationResponse, trimmed);
      } else {
        await runGeminiFallback(trimmed);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "요청을 처리하지 못했습니다."
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (
    response: Extract<
      Exclude<WoohyukmonOperationResponse, { handled: false }>,
      { kind: "confirmation" }
    >
  ) => {
    if (busy) return;
    setBusy(true);

    try {
      const request = await fetch("/api/woohyukmon/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          token: response.token
        })
      });
      const data = (await request.json().catch(() => ({}))) as
        | WoohyukmonOperationResponse
        | { error?: string };

      if (!request.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "확인 작업을 처리하지 못했습니다."
        );
      }

      if ("handled" in data && data.handled) {
        handleOperationResponse(data, "");
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "저장에 실패했습니다. 기존 상태는 변경되지 않았습니다."
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "작업을 취소했습니다."
      }
    ]);
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-[79] bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      {open ? (
        <aside className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[80dvh] flex-col overflow-hidden rounded-t-2xl border border-ink/10 bg-paper shadow-2xl md:inset-x-auto md:bottom-20 md:right-5 md:h-[min(72vh,720px)] md:w-[390px] md:rounded-2xl">
          <header className="flex items-center gap-3 border-b border-ink/10 bg-white/75 px-4 py-3">
            <span className={`flex h-8 w-12 items-center justify-center ${busy ? "animate-spin" : ""}`}>
              <WoohyukmonGlassesIcon className="h-full w-full" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">Woohyukmon</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
                K_LINE Operations · {actorRole}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-ink"
              aria-label="Close Woohyukmon"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="grid min-h-44 place-items-center text-center">
                <div>
                  <div className="mx-auto flex h-12 w-20 items-center justify-center">
                    <WoohyukmonGlassesIcon className="h-full w-full" />
                  </div>
                  <h2 className="mt-3 font-serif text-2xl font-semibold text-ink">
                    무엇을 도와드릴까요?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink/58">
                    회원 현황 조회부터 회비·정회원 승인, 활동 신청 관리까지 한 문장으로 요청하세요.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-10 rounded-2xl rounded-br-md bg-navy px-4 py-3 text-sm leading-6 text-paper"
                      : "mr-2 rounded-2xl rounded-bl-md border border-ink/10 bg-white px-4 py-3 text-sm leading-6 text-ink"
                  }
                >
                  <div className="whitespace-pre-line">{message.content}</div>

                  {message.operation &&
                  "rows" in message.operation &&
                  Array.isArray(message.operation.rows) ? (
                    <CompactTable rows={message.operation.rows} />
                  ) : null}

                  {message.operation?.kind === "candidates" ? (
                    <div className="mt-3 grid gap-2">
                      {message.operation.candidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void send(message.request || "", {
                              silentUser: true,
                              selectedTargetId: candidate.id
                            })
                          }
                          className="rounded-lg border border-ink/10 bg-hanji/45 px-3 py-2 text-left transition hover:border-brass disabled:opacity-50"
                        >
                          <p className="font-semibold text-ink">{candidate.name}</p>
                          <p className="mt-1 text-xs text-ink/58">
                            {candidate.departmentOrMajor} · {candidate.nationality} · 회비{" "}
                            {candidate.paymentConfirmed ? "납부" : "미납"}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {message.operation?.kind === "confirmation" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void confirm(message.operation as Extract<
                          Exclude<WoohyukmonOperationResponse, { handled: false }>,
                          { kind: "confirmation" }
                        >)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ink px-4 text-xs font-semibold text-paper disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {message.operation.targetCount > 1
                          ? `${message.operation.targetCount}명 처리`
                          : "확인"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancel}
                        className="min-h-9 rounded-lg border border-ink/15 bg-white px-4 text-xs font-semibold text-ink disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  ) : null}

                  {message.sources?.length ? (
                    <details className="mt-2 text-[11px] text-ink/50">
                      <summary className="cursor-pointer font-semibold">
                        참고한 외부 자료 {message.sources.length}개
                      </summary>
                      <div className="mt-2 grid gap-1.5">
                        {message.sources.slice(0, 6).map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate underline underline-offset-2 hover:text-navy"
                          >
                            {source.title || source.url}
                          </a>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {message.status ? (
                    <p className="mt-2 text-[11px] font-medium text-ink/45">
                      {message.status}
                    </p>
                  ) : null}
                </div>
              ))}

              {busy ? (
                <div className="mr-12 inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-ink/10 bg-white px-4 py-3 text-xs font-semibold text-ink/55">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  처리 중
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex gap-2 border-t border-ink/10 bg-white/85 p-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={busy}
              placeholder="자연어로 업무를 입력하세요"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink/12 bg-white px-3 text-sm text-ink outline-none focus:border-brass"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition hover:bg-navy disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-4 z-[81] flex h-14 w-16 items-center justify-center rounded-full border border-ink/10 bg-white/95 shadow-xl transition hover:-translate-y-0.5 hover:border-brass md:bottom-5 md:right-5"
        aria-label="Open Global Woohyukmon"
        title="K_LINE Operations"
      >
        <span className={busy ? "animate-spin" : ""}>
          <WoohyukmonGlassesIcon className="h-8 w-12" />
        </span>
      </button>
    </>
  );
}
