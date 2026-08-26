"use client";

import { Bot, LocateFixed, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { JejuShell } from "@/components/jeju/JejuShell";

type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
type Position = { latitude: number; longitude: number };
type StreamEvent = { type?: string; error?: string; text?: string };

const prompts = [
  "Find a place that matches my food preferences.",
  "What have I already explored in Jeju?",
  "Are there any Jeju programs I can join?",
  "I need a quiet, English-friendly place nearby."
];

export function JejuWoohyukmonPanel({ embedded = false }: { embedded?: boolean }) {
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
      setLocationMessage("Location is not available in this browser.");
      return;
    }

    setLocationMessage("Getting a one-time location for your next question…");
    navigator.geolocation.getCurrentPosition(
      (current) => {
        setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        setLocationMessage("Location is ready for your next question and is not saved.");
      },
      () => setLocationMessage("Location was not shared. Woohyukmon can still recommend by your preferences."),
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
        throw new Error(payload.error || "Woohyukmon could not answer right now.");
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
          text: "I could not find a complete answer yet. Try asking with a food type, area, or budget."
        } : item));
      }
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === assistantId ? {
        ...item,
        text: error instanceof Error ? error.message : "Woohyukmon could not answer right now."
      } : item));
    } finally {
      if (currentLocation) {
        setLocation(null);
        setLocationMessage("The one-time location for that question was cleared.");
      }
      setSending(false);
    }
  }

  const chat = (
    <section className={`mx-auto flex w-full max-w-5xl flex-col overflow-hidden border border-[#0d5962]/14 bg-white/84 ${embedded ? "min-h-[32rem]" : "min-h-[calc(100svh-18rem)]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0d5962]/12 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[#073c44]">
          <Bot aria-hidden className="h-5 w-5 text-[#0d5962]" />
          Woohyukmon
        </span>
        <button
          type="button"
          onClick={shareLocation}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#0d5962]/20 px-3 text-xs font-bold text-[#0d5962] transition hover:bg-[#e8f4ef]"
        >
          <LocateFixed aria-hidden className="h-3.5 w-3.5" />
          Use my location
        </button>
      </div>

      <div ref={container} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div className="max-w-md">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#dcefe8] text-[#0d5962]">
                <Bot aria-hidden className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-serif text-2xl font-semibold text-[#073c44]">What would you like to explore?</h2>
              <p className="mt-2 text-sm leading-6 text-[#4c6769]">Ask about places, your preferences, saved visits, or current Jeju programs.</p>
            </div>
          </div>
        ) : messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-sm leading-6 sm:max-w-[78%] ${message.role === "user" ? "bg-[#0d5962] text-white" : "bg-[#edf6f2] text-[#234e53]"}`}>
              {message.text || "…"}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-[#0d5962]/12 p-3 sm:p-4">
        {locationMessage ? <p className="mb-2 text-xs leading-5 text-[#4c6769]">{locationMessage}</p> : null}
        <form onSubmit={(event) => ask(event)} className="flex gap-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Woohyukmon about Jeju" className="min-h-12 min-w-0 flex-1 border border-[#0d5962]/25 bg-white px-3 text-sm text-[#073c44] outline-none focus:border-[#0d5962]" />
          <button disabled={sending} type="submit" className="inline-flex h-12 w-12 shrink-0 items-center justify-center bg-[#0d5962] text-white transition hover:bg-[#073c44] disabled:opacity-60" aria-label="Send question">
            <Send aria-hidden className="h-5 w-5" />
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void ask(undefined, prompt)} className="shrink-0 rounded-full border border-[#0d5962]/18 bg-[#f8fcfa] px-3 py-2 text-left text-xs font-semibold text-[#315b5f] transition hover:bg-[#e8f4ef]">
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  if (embedded) return chat;

  return (
    <JejuShell title="Explore" description="Ask Woohyukmon about Jeju places, your preferences, saved visits, and programs.">
      {chat}
    </JejuShell>
  );
}
