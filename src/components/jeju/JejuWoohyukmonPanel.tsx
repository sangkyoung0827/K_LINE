"use client";

import { LocateFixed, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";
import { useLanguage } from "@/components/LanguageProvider";
import { WoohyukmonGlassesIcon } from "@/components/WoohyukmonGlassesIcon";

type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
type Position = { latitude: number; longitude: number };
type StreamEvent = { type?: string; error?: string; text?: string };

const promptsKo = [
  "내 기록을 바탕으로 다음 활동 3개 추천해줘.",
  "내가 높은 별점을 준 경험과 비슷한 곳을 추천해줘.",
  "아직 안 가본 가까운 장소를 추천해줘.",
  "내 이동 기록과 관심사에 맞는 한국 문화 체험을 추천해줘."
];

const promptsEn = [
  "Recommend my next three experiences from my history.",
  "Suggest places similar to experiences I rated highly.",
  "What nearby places have I not visited yet?",
  "Suggest a Korean cultural experience from my movement and interests."
];

export function JejuWoohyukmonPanel({ embedded = false }: { embedded?: boolean }) {
  const { language } = useLanguage();
  const korean = language === "ko";
  const prompts = korean ? promptsKo : promptsEn;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [location, setLocation] = useState<Position | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [sending, setSending] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    container.current?.scrollTo({ top: container.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function shareLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(korean ? "이 브라우저에서는 위치를 사용할 수 없습니다." : "Location is not available in this browser.");
      return;
    }

    setLocationMessage(korean ? "이번 추천에 사용할 현재 위치를 확인하는 중…" : "Getting a one-time location for this recommendation…");
    navigator.geolocation.getCurrentPosition(
      (current) => {
        setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        setLocationMessage(korean ? "현재 위치를 이번 질문에만 사용합니다." : "Your current location is ready for this question only.");
      },
      () => setLocationMessage(korean ? "위치를 공유하지 않아도 저장된 기록으로 추천할 수 있습니다." : "Woohyukmon can still recommend from your saved history."),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
  }

  async function ask(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    const message = (preset ?? input).trim();
    if (!message || sending) return;

    const history = messages.map((item) => ({ content: item.text, role: item.role }));
    const currentLocation = location;
    const assistantId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: message },
      { id: assistantId, role: "assistant", text: "" }
    ]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/gemini", {
        body: JSON.stringify({ context: "jeju", currentLocation, history, message, modelVersion: "4" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || (korean ? "우혁몬이 지금 답변하지 못했습니다." : "Woohyukmon could not answer right now."));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const streamEvent = JSON.parse(line) as StreamEvent;
          if (streamEvent.type === "text" && streamEvent.text) {
            answer += streamEvent.text;
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: answer } : item));
          }
          if (streamEvent.type === "error") throw new Error(streamEvent.error || "Woohyukmon could not answer right now.");
        }
      }

      if (!answer) {
        setMessages((current) => current.map((item) => item.id === assistantId ? {
          ...item,
          text: korean ? "아직 추천을 만들기 위한 기록이 충분하지 않습니다. 장소를 저장하거나 활동 별점을 남겨보세요." : "There is not enough saved history yet. Save a place or rate an activity first."
        } : item));
      }
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === assistantId ? {
        ...item,
        text: error instanceof Error ? error.message : (korean ? "우혁몬이 지금 답변하지 못했습니다." : "Woohyukmon could not answer right now.")
      } : item));
    } finally {
      if (currentLocation) {
        setLocation(null);
        setLocationMessage(korean ? "이번 질문에 사용한 일회성 위치를 지웠습니다." : "The one-time location for that question was cleared.");
      }
      setSending(false);
    }
  }

  const chat = (
    <section className={`mx-auto flex w-full max-w-5xl flex-col overflow-hidden border border-[#0d5962]/14 bg-white/84 shadow-[0_20px_50px_rgba(13,89,98,.06)] ${embedded ? "min-h-[30rem]" : "min-h-[calc(100svh-18rem)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d5962]/12 bg-[#fbf7ee] px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-3 text-sm font-bold text-[#073c44]">
          <WoohyukmonGlassesIcon className="h-8 w-14" />
          <span><span className="block">Woohyukmon</span><span className="block text-[11px] font-medium text-[#698287]">{korean ? "내 기록을 읽는 한국 탐험 가이드" : "Your Korea journey guide"}</span></span>
        </span>
        <button type="button" onClick={shareLocation} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#0d5962]/20 bg-white px-3 text-xs font-bold text-[#0d5962] transition hover:bg-[#e8f4ef]">
          <LocateFixed aria-hidden className="h-3.5 w-3.5" />
          {korean ? "현재 위치 사용" : "Use current location"}
        </button>
      </div>

      <div ref={container} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="grid min-h-60 place-items-center text-center">
            <div className="max-w-lg">
              <WoohyukmonGlassesIcon className="mx-auto h-14 w-28" />
              <h2 className="mt-4 font-serif text-2xl font-semibold text-[#073c44]">{korean ? "다음 한국 경험을 추천받아보세요" : "Find your next experience in Korea"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4c6769]">{korean ? "우혁몬은 저장된 방문 장소, 별점, 활동 기록과 이동 흐름을 우선 읽습니다. ECC·한활 이력은 취향 참고에만 사용하며 요청하지 않으면 재참여를 추천하지 않습니다." : "Woohyukmon prioritizes your saved places, ratings, activity history, and movement pattern. ECC and Hanhwal history is used only as a taste signal and will not trigger club rejoining recommendations unless you ask."}</p>
            </div>
          </div>
        ) : messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${message.role === "user" ? "bg-[#0d5962] text-white" : "bg-[#edf6f2] text-[#234e53]"}`}>
              {message.text || "…"}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#0d5962]/12 p-3 sm:p-4">
        {locationMessage ? <p className="mb-2 text-xs leading-5 text-[#4c6769]">{locationMessage}</p> : null}
        <form onSubmit={(event) => ask(event)} className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={korean ? "우혁몬에게 다음 경험을 물어보세요" : "Ask Woohyukmon what to do next"} className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#0d5962]/25 bg-white px-3 text-sm text-[#073c44] outline-none focus:border-[#0d5962]" />
          <button disabled={sending} type="submit" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d5962] text-white transition hover:bg-[#073c44] disabled:opacity-60" aria-label="Send question"><Send aria-hidden className="h-5 w-5" /></button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(undefined, prompt)} className="shrink-0 rounded-full border border-[#0d5962]/18 bg-[#f8fcfa] px-3 py-2 text-left text-xs font-semibold text-[#315b5f] transition hover:bg-[#e8f4ef]">{prompt}</button>)}
        </div>
      </div>
    </section>
  );

  if (embedded) return chat;

  return <JejuShell title={korean ? "탐험" : "Explore"} description={korean ? "우혁몬에게 저장된 경험과 이동 기록을 바탕으로 다음 한국 경험을 물어보세요." : "Ask Woohyukmon for your next Korea experience from your saved history and movement."}>{chat}</JejuShell>;
}
