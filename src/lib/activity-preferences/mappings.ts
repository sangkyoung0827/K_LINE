import "server-only";
import type { ActivityMapping } from "./types";
import { preferenceStore, type PreferenceStore } from "./store";

export async function getActivityPreferenceMapping(source: string, activityId: string, store: PreferenceStore = preferenceStore) {
  const rows = await store<ActivityMapping[]>(`activity_preference_activity_map?select=source,activity_id,canonical_title,categories,tags,is_active&source=eq.${encodeURIComponent(source)}&activity_id=eq.${encodeURIComponent(activityId)}&limit=1`);
  return rows[0] ?? null;
}
