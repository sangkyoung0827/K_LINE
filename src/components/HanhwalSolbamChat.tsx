"use client";

import Image from "next/image";
import { FormEvent, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { HanhwalChatMessage } from "@/lib/hanhwalPublic";

const suggestedQuestions = [
  { icon: "🏹", en: "What is Korean traditional archery?", ko: "국궁은 무엇인가요?" },
  { icon: "🎯", en: "What does Hanhwal practice?", ko: "한활에서는 무엇을 연습하나요?" },
  { icon: "🛡️", en: "What are the safety rules?", ko: "안전수칙을 알려주세요." },
  { icon: "📅", en: "When and where do you practice?", ko: "언제 어디에서 연습하나요?" }
] as const;

type ChatItem = HanhwalChatMessage & { id: string };

export function HanhwalSolbamChat() {
  const { language, pick } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(question: string) {
    const message = question.trim();
    if (!message || busy) return;

    const userItem: ChatItem = { id: `user-${Date.now()}`, role: "user", content: message };
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userItem]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/hanhwal/solbam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })
      });
      const payload = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      const content = response.ok && payload.answer
        ? payload.answer
        : payload.error || pick({ en: "Solbam could not answer right now.", ko: "지금은 솔밤이 답변할 수 없습니다." });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content }]);
    } catch {
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: pick({ en: "The connection was interrupted. Please try again.", ko: "연결이 끊겼습니다. 다시 시도해 주세요." })
      }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[#0b2342]/10 bg-white shadow-[0_24px_70px_rgba(11,35,66,0.12)]">
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="relative min-h-[330px] overflow-hidden bg-[#0b2342] p-7 text-white sm:p-10">
          <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full border border-white/10" />
          <p className="relative text-xs font-extrabold tracking-[0.32em] text-[#b8c7d9]">YOUR ARCHERY BUDDY</p>
          <div className="relative mt-8 flex items-center gap-5">
            <Image
              src="/images/hanhwal-site/solbam.webp"
              alt="Solbam, Hanhwal's leopard mascot"
              width={440}
              height={782}
              className="h-28 w-28 rounded-full border-4 border-white/85 object-cover object-top shadow-xl"
            />
            <h2 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              {pick({ en: "Chat with Solbam", ko: "솔밤과 대화하기" })} <span aria-hidden>🐆</span>
            </h2>
          </div>
          <p className="relative mt-7 max-w-md text-base leading-7 text-white/75">
            {pick({
              en: "Ask about Hanhwal, equipment, etiquette, weekly practice, safety, and Korean traditional archery.",
              ko: "한활, 장비, 예절, 주간 연습, 안전수칙과 한국 전통 국궁에 관해 물어보세요."
            })}
          </p>
        </div>

        <div className="flex min-h-[470px] flex-col p-5 sm:p-8">
          <div className="flex-1 space-y-4" aria-live="polite">
            {messages.length === 0 ? (
              <div>
                <p className="text-sm font-bold text-[#0b2342]">
                  {pick({ en: "You can ask me…", ko: "이런 질문을 해보세요…" })}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question.en}
                      type="button"
                      onClick={() => void ask(question[language])}
                      className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#0b2342]/10 bg-[#f7f9fc] px-4 py-3 text-left text-sm font-semibold leading-5 text-[#0b2342] transition hover:-translate-y-0.5 hover:border-[#163c68]/35 hover:bg-white hover:shadow-md"
                    >
                      <span className="text-xl" aria-hidden>{question.icon}</span>
                      <span>{question[language]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-auto bg-[#0b2342] text-white"
                        : "border border-[#0b2342]/10 bg-[#f7f9fc] text-[#0b2342]"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
                {busy ? (
                  <div className="flex w-fit items-center gap-2 rounded-2xl border border-[#0b2342]/10 bg-[#f7f9fc] px-4 py-3 text-sm text-[#526782]">
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    {pick({ en: "Solbam is thinking…", ko: "솔밤이 생각하고 있어요…" })}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form onSubmit={submit} className="mt-6 flex gap-2 border-t border-[#0b2342]/10 pt-5">
            <label htmlFor="solbam-question" className="sr-only">
              {pick({ en: "Question for Solbam", ko: "솔밤에게 할 질문" })}
            </label>
            <input
              ref={inputRef}
              id="solbam-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={1_000}
              placeholder={pick({ en: "Ask Solbam a question…", ko: "솔밤에게 질문해 보세요…" })}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#0b2342]/15 bg-white px-4 text-base text-[#0b2342] outline-none transition placeholder:text-[#526782]/65 focus:border-[#163c68] focus:ring-2 focus:ring-[#163c68]/15"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0b2342] text-white transition hover:bg-[#163c68] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={pick({ en: "Send question", ko: "질문 보내기" })}
            >
              {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Send aria-hidden className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
