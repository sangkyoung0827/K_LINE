"use client";

import Image from "next/image";
import { Bot, Loader2, MessageCircle, Minus, Send, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { woohyukmonQuickPrompts } from "@/data/woohyukmonKnowledge";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요! 저는 K_LINE의 AI 안내자 우혁몬입니다. 굿즈, K-Culture Project, ECC, 한활, 활동 글쓰기까지 무엇이든 물어보세요."
};

function WoohyukmonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-11 w-11";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brass/60 bg-navy text-paper shadow-soft ${sizeClass}`}
    >
      {failed ? (
        <span className="text-sm font-bold">우</span>
      ) : (
        <Image
          src="/images/woohyukmon-icon.png"
          alt="우혁몬 Woohyukmon icon"
          fill
          sizes="64px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function WoohyukmonChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const apiHistory = useMemo(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .map((message) => ({ role: message.role, content: message.content })),
    [messages]
  );

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/woohyukmon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmed,
          history: apiHistory.slice(-6)
        })
      });
      const data = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !data.answer) {
        throw new Error(data.error ?? "우혁몬이 잠시 대답하지 못했습니다.");
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer ?? ""
        }
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "우혁몬이 잠시 대답하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[70] md:bottom-6 md:right-6">
      {open ? (
        <section className="mb-4 flex h-[min(680px,calc(100svh-7rem))] w-[calc(100vw-2.5rem)] max-w-md flex-col overflow-hidden border border-navy/12 bg-paper shadow-lift md:w-[420px]">
          <header className="flex items-center justify-between gap-3 bg-navy p-4 text-paper">
            <div className="flex items-center gap-3">
              <WoohyukmonAvatar size="sm" />
              <div>
                <p className="text-base font-semibold">우혁몬</p>
                <p className="text-xs text-paper/70">K_LINE AI Assistant</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close Woohyukmon chat"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center border border-paper/25 text-paper transition hover:border-brass hover:bg-paper/10"
            >
              <Minus aria-hidden className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" ? <WoohyukmonAvatar size="sm" /> : null}
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap px-4 py-3 text-sm leading-7 ${
                      message.role === "user"
                        ? "bg-navy text-paper"
                        : "border border-navy/10 bg-white/78 text-ink"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <WoohyukmonAvatar size="sm" />
                  <span className="inline-flex items-center gap-2 border border-navy/10 bg-white/78 px-4 py-3">
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    우혁몬이 생각 중입니다...
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {woohyukmonQuickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="border border-navy/12 bg-white/70 px-3 py-2 text-xs font-semibold text-ink transition hover:border-brass hover:bg-brass/15"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="border-t border-red-900/12 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit} className="flex gap-2 border-t border-navy/10 bg-white/60 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="우혁몬에게 물어보기"
              className="min-h-11 flex-1 border border-navy/14 bg-paper px-3 text-sm text-ink outline-none transition focus:border-brass focus:ring-2 focus:ring-brass/20"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 items-center justify-center bg-brass text-ink transition hover:bg-navy hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden className="h-4 w-4" />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex items-center gap-3 bg-navy p-2 pr-4 text-paper shadow-lift transition hover:-translate-y-1 hover:bg-ink"
        aria-label="Open Woohyukmon chat"
      >
        <WoohyukmonAvatar size="lg" />
        <span className="grid text-left">
          <span className="text-sm font-semibold">우혁몬</span>
          <span className="inline-flex items-center gap-1 text-xs text-paper/70">
            <MessageCircle aria-hidden className="h-3 w-3" />
            AI 안내자
          </span>
        </span>
        {open ? <X aria-hidden className="h-4 w-4" /> : <Bot aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  );
}
