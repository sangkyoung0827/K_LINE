"use client";

import { CheckCircle2, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type HomeFeedbackComment = {
  id: string;
  text: string;
  createdAt: string;
  profileImage?: string;
  profileName?: string;
};

const feedbackStorageKey = "k_line_home_feedback_comments";
const resolvedStorageKey = "k_line_home_feedback_resolved_ids";

function readFeedback() {
  try {
    const raw = window.localStorage.getItem(feedbackStorageKey);
    return raw ? (JSON.parse(raw) as HomeFeedbackComment[]) : [];
  } catch {
    return [];
  }
}

function writeFeedback(comments: HomeFeedbackComment[]) {
  window.localStorage.setItem(feedbackStorageKey, JSON.stringify(comments));
}

function readResolvedIds() {
  try {
    const raw = window.localStorage.getItem(resolvedStorageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeResolvedIds(ids: string[]) {
  window.localStorage.setItem(resolvedStorageKey, JSON.stringify(ids));
}

function formatDate(value: string) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DeveloperFeedbackPanel() {
  const [comments, setComments] = useState<HomeFeedbackComment[]>([]);
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);
  const resolvedSet = useMemo(() => new Set(resolvedIds), [resolvedIds]);

  const load = () => {
    setComments(readFeedback());
    setResolvedIds(readResolvedIds());
  };

  useEffect(() => {
    load();
  }, []);

  const markResolved = (id: string) => {
    const nextIds = Array.from(new Set([...resolvedIds, id]));
    setResolvedIds(nextIds);
    writeResolvedIds(nextIds);
  };

  const deleteComment = (id: string) => {
    const nextComments = comments.filter((comment) => comment.id !== id);
    const nextResolvedIds = resolvedIds.filter((resolvedId) => resolvedId !== id);

    setComments(nextComments);
    setResolvedIds(nextResolvedIds);
    writeFeedback(nextComments);
    writeResolvedIds(nextResolvedIds);
  };

  return (
    <section className="bg-paper py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Developer Menu</p>
            <h1 className="mt-3 font-serif text-5xl font-semibold text-ink">
              Site Feedback
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/64">
              Developer-only feedback review area. Feedback is not shown in admin or
              super-admin menus.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-10 items-center gap-2 border border-ink/12 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
          >
            <RefreshCcw aria-hidden className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-10 grid gap-4">
          {comments.length > 0 ? (
            comments.map((comment) => {
              const resolved = resolvedSet.has(comment.id);

              return (
                <article
                  key={comment.id}
                  className="grid gap-4 border border-ink/10 bg-white/70 p-5 shadow-soft md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      {comment.profileImage ? (
                        <img
                          src={comment.profileImage}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full border border-brass/30 object-cover"
                        />
                      ) : (
                        <span className="grid h-10 w-10 rounded-full border border-brass/30 bg-navy text-sm font-semibold text-paper place-items-center">
                          {(comment.profileName || "V").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-semibold text-ink">
                          {comment.profileName || "Visitor"}
                        </p>
                        <p className="mt-1 text-xs text-ink/46">
                          {formatDate(comment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-keep text-sm leading-7 text-ink/72">
                      {comment.text}
                    </p>
                    {resolved ? (
                      <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase text-pine">
                        <CheckCircle2 aria-hidden className="h-4 w-4" />
                        Resolved
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <button
                      type="button"
                      onClick={() => markResolved(comment.id)}
                      disabled={resolved}
                      className="inline-flex h-10 items-center gap-2 border border-pine/20 px-3 text-xs font-semibold text-pine transition hover:bg-pine/10 disabled:opacity-50"
                    >
                      <CheckCircle2 aria-hidden className="h-4 w-4" />
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      className="inline-flex h-10 w-10 items-center justify-center border border-red-900/20 text-red-700 transition hover:bg-red-50"
                      aria-label="Delete feedback"
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="border border-ink/10 bg-white/60 p-6 text-sm leading-7 text-ink/62">
              No local site feedback is stored in this browser yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
