import { preferenceConfig } from "../config";
import { normalizePreferenceUserKey } from "../identity";
import type { ActivityMapping, ApplicationSignalRow, PreferenceEvent } from "../types";

export function applicationPreferenceEvent(source: string, row: ApplicationSignalRow, mapping: ActivityMapping | null): PreferenceEvent | null {
  const userKey = normalizePreferenceUserKey(row.user_id);
  if (!userKey || !row.id || !row.activity_id || !Number.isFinite(Date.parse(row.created_at))) return null;
  const classified = mapping?.is_active && mapping.source === source && mapping.activity_id === row.activity_id;
  return {
    user_key: userKey, source, activity_id: row.activity_id,
    activity_instance_id: row.activity_instance_id ?? null,
    source_event_key: `${source}_application:${row.id}`, event_type: "applied",
    categories: classified ? [...mapping.categories] : [],
    tags: classified ? [...mapping.tags] : [],
    rating: null, base_weight: preferenceConfig.appliedWeight,
    occurred_at: row.created_at, metadata: {}
  };
}
