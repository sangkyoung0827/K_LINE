"use client";

import { Loader2, Send } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

type GroundingSource = {
  title: string;
  url: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: GroundingSource[];
};

type GeminiStreamEvent =
  | { type: "status"; status?: string }
  | { type: "text"; text?: string }
  | { type: "grounding"; groundingChunks?: GroundingSource[]; webSearchQueries?: string[] }
  | { type: "done"; groundingChunks?: GroundingSource[]; webSearchQueries?: string[] }
  | { type: "error"; error?: string };

type LocalBoardPostForAssistant = {
  author: string;
  boardId: "ecc" | "hanhwal";
  content: string;
  createdAt: string;
  id: string;
  title: string;
};

function readLocalBoardPostsForAssistant(): LocalBoardPostForAssistant[] {
  if (typeof window === "undefined") return [];

  const boardKeys = [
    { boardId: "ecc" as const, key: "k_line_free_board_ecc_posts" },
    { boardId: "hanhwal" as const, key: "k_line_free_board_hanhwal_posts" }
  ];

  return boardKeys.flatMap(({ boardId, key }) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      return parsed.slice(0, 30).flatMap((post) => {
        if (!post || typeof post !== "object") return [];
        const candidate = post as Partial<LocalBoardPostForAssistant>;

        if (
          typeof candidate.id !== "string" ||
          typeof candidate.title !== "string" ||
          typeof candidate.content !== "string"
        ) {
          return [];
        }

        return [
          {
            author: typeof candidate.author === "string" ? candidate.author.slice(0, 120) : "",
            boardId,
            content: candidate.content.slice(0, 900),
            createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt.slice(0, 80) : "",
            id: candidate.id.slice(0, 120),
            title: candidate.title.slice(0, 180)
          }
        ];
      });
    } catch {
      return [];
    }
  });
}

function WoohyukmonAvatar() {
  return (
    <span className="flex h-8 w-14 shrink-0 items-center justify-center" aria-hidden>
      <WoohyukmonGlassesIcon className="h-full w-full" />
    </span>
  );
}

function getCoreAnswer(message: string, language: "en" | "ko") {
  const normalized = message.toLowerCase().replace(/\s+/g, "").replace(/[?!.,~]/g, "");
  const asksEcc =
    normalized === "ecc가뭐야" ||
    normalized === "ecc가뭐예요" ||
    normalized === "ecc란" ||
    normalized === "whatiscec" ||
    normalized === "whatisecc";

  if (!asksEcc) return null;

  return language === "ko"
    ? "ECC는 English Conversation Club의 약자로, 전북대학교에서 한국 학생과 외국인 학생이 영어 회화와 다양한 교류 활동을 함께하는 국제교류 중심 동아리입니다. 영어를 공부하는 것뿐 아니라 친목 활동, 문화교류, 정기 모임과 여러 캠퍼스 활동을 통해 서로 자연스럽게 교류하는 것이 핵심입니다."
    : "ECC stands for English Conversation Club. It is a Jeonbuk National University student community where Korean and international students meet through English conversation, campus activities, friendship, and cultural exchange.";
}

function mergeSources(current: GroundingSource[], incoming: GroundingSource[]) {
  const sourceMap = new Map<string, GroundingSource>();

  for (const source of current) {
    if (source.url) {
      sourceMap.set(source.url, source);
    }
  }

  for (const source of incoming) {
    if (source.url && !sourceMap.has(source.url)) {
      sourceMap.set(source.url, source);
    }
  }

  return Array.from(sourceMap.values());
}

function parseNdjsonLine(line: string): GeminiStreamEvent | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as GeminiStreamEvent;
  } catch {
    return null;
  }
}

export function WoohyukmonChatbot() {
  const { language } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentAtRef = useRef(0);

  const apiHistory = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  const updateAssistantMessage = (
    assistantId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) => {
    setMessages((current) =>
      current.map((message) => (message.id === assistantId ? updater(message) : message))
    );
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const now = Date.now();
    if (now - lastSentAtRef.current < 1200) return;
    lastSentAtRef.current = now;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");

    const coreAnswer = getCoreAnswer(trimmed, language);
    if (coreAnswer) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: coreAnswer
        }
      ]);
      window.setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }

    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        sources: []
      }
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: apiHistory.slice(-8),
          localBoardPosts: readLocalBoardPostsForAssistant()
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(language === "ko" ? "답변을 생성하지 못했습니다." : "Could not generate an answer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const event = parseNdjsonLine(line);

          if (!event) {
            continue;
          }

          if (event.type === "text" && event.text) {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              content: `${message.content}${event.text}`
            }));
          }

          if ((event.type === "grounding" || event.type === "done") && event.groundingChunks) {
            updateAssistantMessage(assistantId, (message) => ({
              ...message,
              sources: mergeSources(message.sources ?? [], event.groundingChunks ?? [])
            }));
          }

          if (event.type === "error") {
            throw new Error(
              event.error ??
                (language === "ko"
                  ? "우혁몬 검색 응답 중 오류가 발생했습니다."
                  : "Woohyukmon search response failed.")
            );
          }
        }
      }

      const lastEvent = parseNdjsonLine(buffer);
      if (lastEvent?.type === "text" && lastEvent.text) {
        updateAssistantMessage(assistantId, (message) => ({
          ...message,
          content: `${message.content}${lastEvent.text}`
        }));
      }
      if ((lastEvent?.type === "grounding" || lastEvent?.type === "done") && lastEvent.groundingChunks) {
        updateAssistantMessage(assistantId, (message) => ({
          ...message,
          sources: mergeSources(message.sources ?? [], lastEvent.groundingChunks ?? [])
        }));
      }

      updateAssistantMessage(assistantId, (message) => ({
        ...message,
        content:
          message.content.trim().length > 0
            ? message.content
            : language === "ko"
              ? "답변을 생성하지 못했습니다. 다시 질문해 주세요."
              : "I could not generate an answer. Please try again."
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : language === "ko"
            ? "잠시 후 다시 시도해 주세요."
            : "Please try again in a moment."
      );
      updateAssistantMessage(assistantId, (message) => ({
        ...message,
        content:
          message.content.trim().length > 0
            ? message.content
            : language === "ko"
              ? "우혁몬이 잠시 대답하지 못했습니다. 잠시 후 다시 시도해 주세요."
              : "Woohyukmon could not answer for a moment. Please try again soon."
      }));
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <section className="flex w-full flex-col overflow-hidden rounded-[2rem] border border-navy/12 bg-white/58 text-left shadow-[0_22px_60px_rgba(31,42,68,0.09)] backdrop-blur">
      <div className="max-h-[560px] min-h-[430px] flex-1 overflow-y-auto p-5 md:p-7">
        {messages.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center text-center text-sm font-medium text-muted">
            {language === "ko" ? "우혁몬에게 무엇이든 물어보세요." : "Ask Woohyukmon anything."}
          </div>
        ) : (
          <div className="grid gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" ? <WoohyukmonAvatar /> : null}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                    message.role === "user"
                      ? "bg-navy text-paper"
                      : "border border-navy/10 bg-white/84 text-ink"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>

                  {message.role === "assistant" && message.sources && message.sources.length > 0 ? (
                    <div className="mt-4 border-t border-navy/10 pt-3">
                      <p className="text-xs font-bold text-navy">🔍 참조한 웹 출처</p>
                      <ul className="mt-2 grid gap-1.5">
                        {message.sources.slice(0, 6).map((source, index) => (
                          <li key={source.url} className="text-xs leading-5">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-navy underline underline-offset-4 hover:text-brass"
                            >
                              {index + 1}. {source.title || source.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <WoohyukmonAvatar />
                <span className="inline-flex items-center gap-2 rounded-2xl border border-navy/10 bg-white/84 px-4 py-3">
                  <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                  {language === "ko" ? "검색하고 답변 중..." : "Searching and answering..."}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-red-900/12 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="flex gap-2 border-t border-navy/10 bg-white/64 p-3 md:p-4">
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={language === "ko" ? "우혁몬에게 물어보기" : "Ask Woohyukmon"}
          className="min-h-12 flex-1 rounded-xl border border-navy/14 bg-paper px-4 text-sm text-ink outline-none transition focus:border-brass focus:ring-2 focus:ring-brass/20"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass text-ink transition hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send aria-hidden className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
