"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import type { GoogleFormClubKey } from "@/lib/googleForms/types";

type PublicForm = { id: string; activityId: string | null; title: string; description: string; responderUrl: string; deadline: string | null; responseCount: number };

export function GoogleFormApplicationLink({ activityId, clubKey, className = "", language = "ko" }: { activityId: string; clubKey: GoogleFormClubKey; className?: string; language?: "ko" | "en" }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const controller = new AbortController(); fetch(`/api/google-forms/public?club_key=${encodeURIComponent(clubKey)}&activity_id=${encodeURIComponent(activityId)}`, { signal: controller.signal }).then((response) => response.json()).then((data: { forms?: PublicForm[] }) => { if (!controller.signal.aborted) setForm(data.forms?.[0] || null); }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setReady(true); }); return () => controller.abort(); }, [activityId, clubKey]);
  if (!ready) return <span className={`inline-flex min-h-11 items-center px-5 text-sm font-semibold opacity-60 ${className}`}>{language === "ko" ? "신청폼 확인 중" : "Checking application form"}</span>;
  if (!form) return <span className={`inline-flex min-h-11 items-center border border-ink/15 px-5 text-sm font-semibold text-ink/55 ${className}`}>{language === "ko" ? "신청 준비 중" : "Applications coming soon"}</span>;
  return <a href={form.responderUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy ${className}`}>{language === "ko" ? "신청하기" : "Apply"}<ExternalLink className="h-4 w-4" /></a>;
}

export function GoogleFormResponseCount({ activityId, clubKey, language = "ko" }: { activityId: string; clubKey: GoogleFormClubKey; language?: "ko" | "en" }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { const controller = new AbortController(); fetch(`/api/google-forms/public?club_key=${encodeURIComponent(clubKey)}&activity_id=${encodeURIComponent(activityId)}`, { signal: controller.signal }).then((response) => response.json()).then((data: { forms?: PublicForm[] }) => { if (!controller.signal.aborted) setCount(data.forms?.[0]?.responseCount ?? null); }).catch(() => {}); return () => controller.abort(); }, [activityId, clubKey]);
  return <>{language === "ko" ? "Google Forms 응답" : "Google Forms responses"}: {count ?? "-"}</>;
}
