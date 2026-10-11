"use client";

import { useState } from "react";
import { Glasses, Send } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { eventDetailQuestion, missingEventDetails, type EventDetails, type EventDetailField } from "@/lib/eventStudio/details";

export function EventDetailsPrompt({ details, title, busy, onAnswer }: {
  details: EventDetails; title: string; busy: boolean; onAnswer: (field: EventDetailField, value: string | number) => Promise<void>;
}) {
  const { language } = useLanguage(); const ko = language === "ko";
  const field = missingEventDetails(details)[0];
  if (!field) return null;
  return <Question key={field} field={field} title={title} ko={ko} busy={busy} onAnswer={onAnswer} />;
}
function Question({ field, title, ko, busy, onAnswer }: {
  field: EventDetailField; title: string; ko: boolean; busy: boolean; onAnswer: (field: EventDetailField, value: string | number) => Promise<void>;
}) {
  const [answer, setAnswer] = useState(""), [time, setTime] = useState("");
  const isDate = field === "activityDate" || field === "applicationDeadline";
  const question = eventDetailQuestion(field, title, ko);
  const label = ({ activityDate: ["진행 날짜", "Event date"], applicationDeadline: ["신청 마감", "Application deadline"], capacity: ["모집 인원", "Participants"], location: ["진행 장소", "Event venue"] })[field][ko ? 0 : 1];
  return <div className="space-y-3 border-l-2 border-brass pl-4">
    <p role="status" className="flex items-start gap-2 text-sm font-semibold"><Glasses className="h-5 w-5 shrink-0" />{question}</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={async event => {
      event.preventDefault(); if (busy || !answer.trim()) return;
      const value = field === "capacity" ? Number(answer) : isDate && time ? `${answer}T${time}:00+09:00` : answer.trim();
      await onAnswer(field, value);
    }}>
      <label className="grid min-w-0 flex-1 basis-40 gap-1 text-sm"><span className="sr-only">{label}</span><input required disabled={busy} aria-label={label} type={isDate ? "date" : field === "capacity" ? "number" : "text"} min={field === "capacity" ? 1 : undefined} max={field === "capacity" ? 100000 : undefined} maxLength={field === "location" ? 300 : undefined} step={field === "capacity" ? 1 : undefined} className="form-field min-w-0 w-full" value={answer} onChange={event => setAnswer(event.target.value)} /></label>
      {isDate && <label className="grid min-w-0 gap-1 text-xs"><span>{ko ? "시간 (선택 · 한국 시간)" : "Time (optional · KST)"}</span><input disabled={busy} aria-label={ko ? "시간 (선택 · 한국 시간)" : "Time (optional · KST)"} className="form-field w-36 max-w-full" type="time" value={time} onChange={event => setTime(event.target.value)} /></label>}
      <button aria-label={ko ? "답변 보내기" : "Send answer"} title={ko ? "답변 보내기" : "Send answer"} disabled={busy || !answer.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink text-paper disabled:opacity-40"><Send className="h-4 w-4" /></button>
    </form>
  </div>;
}
