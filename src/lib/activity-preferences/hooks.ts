import "server-only";
import { after } from "next/server";
import { recordApplicationPreferenceEvent, recordRatingPreferenceEvent } from "./events";
import { recomputeUserActivityPreferences } from "./server";
import { logPreferenceFailure } from "./store";
import { ratingPreferenceAdapter } from "./adapters/ratings";
import { preferenceStore } from "./store";
import type { ApplicationSignalRow, RatingSignalRow } from "./types";

export function schedulePreferenceAttempt(task: () => Promise<unknown>) {
  try {
    after(async () => {
      try { await task(); }
      catch { logPreferenceFailure("ingestion"); }
    });
  } catch { logPreferenceFailure("schedule"); }
}

export function scheduleApplicationPreference(source: string, row: ApplicationSignalRow) {
  schedulePreferenceAttempt(async () => {
    const event = await recordApplicationPreferenceEvent(source, row);
    if (event) await recomputeUserActivityPreferences(event.userKey);
  });
}

export function scheduleRatingPreference(recordId: string, userKey: string) {
  schedulePreferenceAttempt(async () => {
    const rows = await preferenceStore<RatingSignalRow[]>(`${ratingPreferenceAdapter.table}?select=${ratingPreferenceAdapter.columns}&id=eq.${encodeURIComponent(recordId)}&user_id=eq.${encodeURIComponent(userKey)}&${ratingPreferenceAdapter.filter}&limit=1`);
    if (!rows[0]) return;
    const event = await recordRatingPreferenceEvent(rows[0]);
    if (event) await recomputeUserActivityPreferences(event.userKey);
  });
}
