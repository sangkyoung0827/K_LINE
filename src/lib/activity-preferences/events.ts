import "server-only";
import { preferenceConfig } from "./config";
import { preferenceCategoryIds } from "./taxonomy";
import { normalizePreferenceUserKey } from "./identity";
import { preferenceStore, type PreferenceStore } from "./store";
import { getActivityPreferenceMapping } from "./mappings";
import { applicationPreferenceEvent } from "./adapters/applications";
import { ratingPreferenceEvent } from "./adapters/ratings";
import type { ApplicationSignalRow, PreferenceEvent, RatingSignalRow } from "./types";

export function validatePreferenceEvent(event: PreferenceEvent) {
  if (!event.user_key || event.user_key !== normalizePreferenceUserKey(event.user_key)
    || !event.source || !event.activity_id || !event.source_event_key
    || !Number.isFinite(Date.parse(event.occurred_at)) || Object.keys(event.metadata).length
    || event.categories.some((key) => !preferenceCategoryIds.has(key))
    || event.tags.some((key) => !/^[a-z0-9_]{1,64}$/.test(key))) throw new Error("INVALID_PREFERENCE_EVENT");
  const expected = event.event_type === "applied" && event.rating === null ? preferenceConfig.appliedWeight
    : event.event_type === "rating_submitted" && event.rating !== null && Number.isInteger(event.rating)
      ? preferenceConfig.ratingWeights[event.rating] : undefined;
  if (expected === undefined || expected !== event.base_weight) throw new Error("INVALID_PREFERENCE_SIGNAL");
}

export async function recordPreferenceEvent(event: PreferenceEvent, store: PreferenceStore = preferenceStore) {
  validatePreferenceEvent(event);
  return store<{ inserted: boolean }>("rpc/record_activity_preference_event", {
    method: "POST", body: JSON.stringify({ p_event: event })
  });
}

export async function recordApplicationPreferenceEvent(source: string, row: ApplicationSignalRow, store: PreferenceStore = preferenceStore) {
  const mapping = await getActivityPreferenceMapping(source, row.activity_id, store);
  const event = applicationPreferenceEvent(source, row, mapping);
  if (!event) return null;
  const result = await recordPreferenceEvent(event, store);
  return { ...result, userKey: event.user_key };
}

export async function recordRatingPreferenceEvent(row: RatingSignalRow, store: PreferenceStore = preferenceStore) {
  if (row.rating === null || !row.rated_at) return null;
  const mapping = await getActivityPreferenceMapping(row.source, row.activity_id, store);
  const event = ratingPreferenceEvent(row, mapping);
  if (!event) return null;
  const result = await recordPreferenceEvent(event, store);
  return { ...result, userKey: event.user_key };
}
