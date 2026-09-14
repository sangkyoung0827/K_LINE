"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, History, LoaderCircle, LogIn, RefreshCw, Star } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { appendHistory, historyDate, type MyHistoryRecord, type MyHistoryResponse } from "@/lib/myHistory";

export function MyHistory() {
  const { language } = useLanguage();
  const { data: session, status } = useSession();
  const ownerEmail = session?.user?.email?.trim().toLowerCase() || "";
  return (
    <section className="mx-auto min-h-[60dvh] w-full max-w-3xl px-5 py-6 md:px-8 md:py-12">
      <header className="flex items-center gap-3 border-b border-navy/10 pb-5">
        <History aria-hidden className="h-6 w-6 shrink-0 text-navy" />
        <h1 className="text-2xl font-bold text-ink">My history</h1>
        <span className="ml-auto text-xs text-muted">{language === "ko" ? "최신순" : "Newest first"}</span>
      </header>
      {status === "loading" ? <HistoryLoading /> : status !== "authenticated" || !ownerEmail
        ? <HistoryLogin /> : <HistoryRecords key={ownerEmail} ownerEmail={ownerEmail} />}
    </section>
  );
}

function HistoryLoading() {
  const { language } = useLanguage();
  return <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted"><LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />{language === "ko" ? "활동 기록을 불러오는 중입니다." : "Loading your activity history..."}</p>;
}

function HistoryLogin() {
  const { language } = useLanguage();
  return <div className="py-6"><p className="mb-4 text-sm text-muted">{language === "ko" ? "활동 기록을 보려면 로그인해 주세요." : "Sign in to see your activity history."}</p><Link href="/login?callbackUrl=%2Fmy-history" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white"><LogIn aria-hidden className="h-4 w-4" />{language === "ko" ? "로그인" : "Sign in"}</Link></div>;
}

export function HistoryRecords({ ownerEmail }: { ownerEmail: string }) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const [records, setRecords] = useState<MyHistoryRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [request, setRequest] = useState<{ cursor: string | null; attempt: number }>({ cursor: null, attempt: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [invalidSession, setInvalidSession] = useState(false);
  const requestPending = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    requestPending.current = true;
    setLoading(true);
    setError(false);
    const query = request.cursor ? `?${new URLSearchParams({ cursor: request.cursor })}` : "";
    void fetch(`/api/activity-history/timeline${query}`, { method: "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) { setInvalidSession(true); setRecords([]); return; }
        if (!response.ok) throw new Error("History unavailable");
        const data = await response.json() as MyHistoryResponse;
        if (!active) return;
        if (data.ownerEmail !== ownerEmail) { setInvalidSession(true); setRecords([]); return; }
        if (!Array.isArray(data.records) || (data.nextCursor !== null && typeof data.nextCursor !== "string")) throw new Error("Invalid history response");
        setRecords((current) => request.cursor ? appendHistory(current, data.records) : data.records);
        setNextCursor(data.nextCursor);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) { setLoading(false); requestPending.current = false; }
      });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [ownerEmail, request]);

  const loadMore = () => {
    if (requestPending.current || loading) return;
    requestPending.current = true;
    setRequest((current) => ({ cursor: error ? current.cursor : nextCursor, attempt: current.attempt + 1 }));
  };

  if (invalidSession) return <HistoryLogin />;
  return (
    <>
      <ol aria-label={ko ? "내 활동 기록" : "My activity history"} className="divide-y divide-navy/10">
        {records.map((record) => (
          <li key={record.id} className="flex items-start gap-3 py-5">
            <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${record.source === "ecc" ? "bg-navy" : "bg-pine"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted">{record.source === "ecc" ? "ECC" : ko ? "한활" : "Hanhwal"}</p>
              <h2 className="mt-1 break-words text-base font-semibold leading-6 text-ink [overflow-wrap:anywhere]">{record.activityTitle || (ko ? "활동" : "Activity")}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>{record.closedAt ? <><span>{ko ? "신청 마감 " : "Registration closed "}</span><time dateTime={record.closedAt}>{historyDate(record.closedAt, language)}</time></> : historyDate(null, language)}</span>
                {record.rating !== null && record.rating >= 1 && record.rating <= 5 ? <span className="inline-flex items-center gap-1" aria-label={`${ko ? "내 별점" : "My rating"}: ${record.rating}/5`}><Star aria-hidden className="h-3.5 w-3.5 fill-brass text-brass" />{record.rating}/5</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {loading ? <HistoryLoading /> : error ? (
        <div role="status" className="py-5"><p className="text-sm text-muted">{ko ? "활동 기록을 불러오지 못했습니다." : "Activity history could not be loaded."}</p><button type="button" onClick={loadMore} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy"><RefreshCw aria-hidden className="h-4 w-4" />{ko ? "다시 시도" : "Retry"}</button></div>
      ) : records.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{ko ? "아직 저장된 활동 기록이 없습니다." : "No activity history yet."}</p>
      ) : nextCursor ? (
        <button type="button" onClick={loadMore} className="my-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-navy/15 text-sm font-semibold text-navy"><ChevronDown aria-hidden className="h-4 w-4" />{ko ? "더 보기" : "Load more"}</button>
      ) : null}
    </>
  );
}
