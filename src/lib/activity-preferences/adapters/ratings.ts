import { preferenceConfig } from "../config";
import { normalizePreferenceUserKey } from "../identity";
import type { ActivityMapping, PreferenceEvent, RatingSignalRow } from "../types";

export function ratingPreferenceEvent(row: RatingSignalRow, mapping: ActivityMapping | null): PreferenceEvent | null {
  const userKey = normalizePreferenceUserKey(row.user_id);
  if (!userKey || !row.id || !row.source || !row.activity_id || row.rating === null || !row.rated_at
    || !Number.isInteger(row.rating) || !(row.rating in preferenceConfig.ratingWeights)
    || !Number.isFinite(Date.parse(row.rated_at))) return null;
  const classified = mapping?.is_active && mapping.source === row.source && mapping.activity_id === row.activity_id;
  return {
    user_key: userKey, source: row.source, activity_id: row.activity_id,
    activity_instance_id: row.activity_instance_id ?? null,
    // Normalize equivalent timestamp representations from PATCH and later REST scans.
    source_event_key: `activity_rating:${row.id}:${new Date(row.rated_at).toISOString()}`,
    event_type: "rating_submitted", categories: classified ? [...mapping.categories] : [],
    tags: classified ? [...mapping.tags] : [],
    rating: row.rating, base_weight: preferenceConfig.ratingWeights[row.rating],
    occurred_at: row.rated_at, metadata: {}
  };
}
export const ratingPreferenceAdapter = {
  table: "user_activity_records",
  columns: "id,user_id,source,activity_id,activity_instance_id,rating,rated_at",
  filter: "rating=not.is.null&rated_at=not.is.null",
  toEvent: ratingPreferenceEvent
};
