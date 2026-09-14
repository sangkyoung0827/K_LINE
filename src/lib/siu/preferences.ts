import "server-only";
import { schedulePreferenceAttempt } from "@/lib/activity-preferences/hooks";
import { applicationPreferenceEvent } from "@/lib/activity-preferences/adapters/applications";
import { ratingPreferenceEvent } from "@/lib/activity-preferences/adapters/ratings";
import { recordPreferenceEvent } from "@/lib/activity-preferences/events";
import { recomputeUserActivityPreferences } from "@/lib/activity-preferences/server";
import { preferenceStore } from "@/lib/activity-preferences/store";
import { siuSource, type SiuApplication } from "./model";

export function siuPreferenceEvents(row: SiuApplication) {
  const mapping = { source: siuSource, activity_id: row.activity_id, canonical_title: row.title_snapshot,
    categories: row.categories_snapshot, tags: row.tags_snapshot, is_active: true };
  return [
    applicationPreferenceEvent(siuSource, { id: row.id, user_id: row.user_key, activity_id: row.activity_id,
      activity_instance_id: row.activity_id, created_at: row.applied_at }, mapping),
    ratingPreferenceEvent({ id: row.id, user_id: row.user_key, source: siuSource, activity_id: row.activity_id,
      activity_instance_id: row.activity_id, rating: row.rating, rated_at: row.rated_at }, mapping)
  ].filter((event) => event !== null);
}
export async function syncSiuPreference(row: SiuApplication) {
  // The existing engine resolves structured categories from its canonical map.
  // Keep its SQL/writer unchanged; register only this SIU activity's mapping.
  await preferenceStore("activity_preference_activity_map?on_conflict=source,activity_id", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ source: siuSource, activity_id: row.activity_id, canonical_title: row.title_snapshot,
      categories: row.categories_snapshot, tags: row.tags_snapshot, is_active: true })
  });
  for (const event of siuPreferenceEvents(row)) await recordPreferenceEvent(event);
  await recomputeUserActivityPreferences(row.user_key);
  // A rating that arrives during application ingestion must remain pending.
  const ratingFilter = row.rated_at ? `eq.${encodeURIComponent(row.rated_at)}` : "is.null";
  await preferenceStore(`siu_activity_applications?id=eq.${row.id}&rated_at=${ratingFilter}`, {
    method: "PATCH", body: JSON.stringify({ preference_synced: true })
  });
}
export function scheduleSiuPreference(row: SiuApplication) {
  schedulePreferenceAttempt(() => syncSiuPreference(row));
}
export async function retrySiuPreferences() {
  const rows = await preferenceStore<SiuApplication[]>("siu_activity_applications?select=*&preference_synced=eq.false&order=id.asc&limit=25");
  let synced = 0;
  for (const row of rows) { try { await syncSiuPreference(row); synced++; } catch { /* Durable pending rows remain retryable. */ } }
  return { attempted: rows.length, synced };
}
