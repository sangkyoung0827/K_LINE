"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, LogIn, RefreshCw, X } from "lucide-react";
import { ClubMark } from "@/components/ClubMark";
import { useLanguage } from "@/components/LanguageProvider";
import { loadMyClubs, myClubOptions, type MyClubResult } from "@/lib/myClubs";

type Props = {
  ownerEmail: string;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  returnTo: string;
  onClose: () => void;
};

export function MyClubsSheet({ ownerEmail, sessionStatus, returnTo, onClose }: Props) {
  const { language } = useLanguage();
  const ko = language === "ko";
  const dialog = useRef<HTMLDialogElement>(null);
  const [results, setResults] = useState<MyClubResult[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    if (desktop.matches) { onClose(); return; }
    const previousOverflow = document.body.style.overflow;
    const resize = () => { if (desktop.matches) onClose(); };
    element.showModal();
    document.body.style.overflow = "hidden";
    desktop.addEventListener("change", resize);
    return () => {
      desktop.removeEventListener("change", resize);
      document.body.style.overflow = previousOverflow;
      element.close();
    };
  }, [onClose]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !ownerEmail) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    setResults(null);
    void loadMyClubs(ownerEmail, controller.signal).then((data) => {
      if (active) setResults(data);
      window.clearTimeout(timeout);
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [ownerEmail, sessionStatus, attempt]);

  const loginRequired = sessionStatus === "unauthenticated" ||
    (sessionStatus === "authenticated" && !ownerEmail) ||
    results?.some((item) => item.status === "unauthenticated");
  const loading = sessionStatus === "loading" || (!loginRequired && results === null);
  const visible = results?.filter((item) => item.status === "member" || item.status === "pending") ?? [];
  const failed = results?.filter((item) => item.status === "unavailable") ?? [];

  return (
    <dialog
      ref={dialog}
      id="mobile-my-clubs"
      aria-labelledby="my-clubs-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[75dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-lg border border-navy/10 bg-paper p-0 text-ink shadow-xl backdrop:bg-black/35"
    >
      <section className="px-4 pt-3 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3 border-b border-navy/10 pb-2">
          <h2 id="my-clubs-title" className="text-lg font-bold">My clubs</h2>
          <button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"} title={ko ? "닫기" : "Close"} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-navy/5">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted"><LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />{ko ? "가입 정보를 불러오는 중입니다." : "Loading your clubs..."}</p>
        ) : loginRequired ? (
          <div className="py-4">
            <p className="mb-3 text-sm text-muted">{ko ? "로그인하면 가입한 클럽을 볼 수 있습니다." : "Sign in to see your clubs."}</p>
            <Link onClick={onClose} href={`/login?callbackUrl=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white"><LogIn aria-hidden className="h-4 w-4" />{ko ? "로그인" : "Sign in"}</Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-navy/10">
              {visible.map(({ id, status }) => {
                const club = myClubOptions.find((item) => item.id === id)!;
                return (
                  <li key={id}>
                    <Link href={status === "pending" ? `${club.href}/register` : club.href} onClick={onClose} className="flex min-h-20 items-center gap-3 py-3">
                      <ClubMark id={id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold">{club.name[language]}</span>
                        <span className="block text-xs text-muted">{status === "pending" ? (ko ? "승인 대기" : "Pending approval") : (ko ? "가입한 클럽" : "Joined")}</span>
                      </span>
                      <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {visible.length === 0 && failed.length === 0 ? <p className="py-6 text-sm text-muted">{ko ? "아직 가입한 클럽이 없습니다." : "You have not joined any clubs yet."}</p> : null}
            {failed.length > 0 ? (
              <div role="status" className="py-3">
                <p className="text-sm text-muted">{failed.map(({ id }) => myClubOptions.find((club) => club.id === id)!.name[language]).join(", ")}{ko ? " 가입 정보를 불러오지 못했습니다." : " membership could not be loaded."}</p>
                <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><RefreshCw aria-hidden className="h-4 w-4" />{ko ? "다시 시도" : "Retry"}</button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </dialog>
  );
}
