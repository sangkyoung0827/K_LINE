"use client";

import { Loader2, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type PendingRating = {
  activityTitle: string;
  id: string;
  source: "ecc" | "hanhwal";
};

export function ActivityRatingModal() {
  const { language } = useLanguage();
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/activity-history/rating")
      .then((response) => response.json())
      .then((data: { rating?: PendingRating | null }) => {
        if (active && data.rating?.id) {
          setPendingRating(data.rating);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const updateRecord = async (action: "dismiss" | "rate") => {
    if (!pendingRating || saving || (action === "rate" && selectedRating === 0)) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/activity-history/rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rating: selectedRating,
          recordId: pendingRating.id
        })
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Activity rating could not be saved.");
      }

      setPendingRating(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : language === "ko"
            ? "별점을 저장하지 못했습니다."
            : "Activity rating could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!pendingRating) {
    return null;
  }

  const sourceLabel = pendingRating.source === "ecc" ? "ECC" : "한활";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/20 p-4 sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-rating-title"
        className="paper-panel relative w-full max-w-sm p-6 shadow-[0_28px_72px_rgba(31,42,68,0.24)] sm:p-7"
      >
        <button
          type="button"
          onClick={() => void updateRecord("dismiss")}
          disabled={saving}
          aria-label={language === "ko" ? "별점 요청 닫기" : "Dismiss activity rating"}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center text-ink/52 transition hover:bg-hanji hover:text-ink disabled:opacity-50"
        >
          {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <X aria-hidden className="h-5 w-5" />}
        </button>

        <p className="text-xs font-semibold uppercase text-brass">{sourceLabel}</p>
        <h2 id="activity-rating-title" className="mt-3 pr-8 font-serif text-2xl font-semibold text-ink">
          {language === "ko" ? "이번 활동은 어땠나요?" : "How was this activity?"}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">{pendingRating.activityTitle}</p>

        <div className="mt-7 flex items-center justify-center gap-1.5" role="group" aria-label="Activity rating">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => setSelectedRating(rating)}
              aria-label={`${rating} stars`}
              aria-pressed={selectedRating === rating}
              className="inline-flex h-10 w-10 items-center justify-center transition hover:scale-110 disabled:opacity-50"
              disabled={saving}
            >
              <Star
                aria-hidden
                className={`h-7 w-7 ${rating <= selectedRating ? "fill-brass text-brass" : "text-ink/25"}`}
              />
            </button>
          ))}
        </div>

        {error ? <p role="alert" className="mt-4 text-center text-sm font-semibold text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={selectedRating === 0 || saving}
          onClick={() => void updateRecord("rate")}
          className="mt-7 inline-flex min-h-11 w-full items-center justify-center bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : language === "ko" ? "저장하기" : "Save"}
        </button>
      </section>
    </div>
  );
}
