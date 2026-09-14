import "server-only";
import { ACTIVITY_PREFERENCE_MODEL_VERSION, preferenceConfig } from "./config";
import { eccPreferenceAdapter } from "./adapters/ecc";
import { hanhwalPreferenceAdapter } from "./adapters/hanhwal";
import { ratingPreferenceAdapter } from "./adapters/ratings";
import { recordPreferenceEvent } from "./events";
import { recomputeUserActivityPreferences } from "./server";
import { preferencePages, preferenceStore, type PreferenceStore } from "./store";
import type { ActivityMapping, ApplicationSignalRow, PreferenceEvent, RatingSignalRow } from "./types";

export async function reconcileActivityPreferences(options: { apply?: boolean; store?: PreferenceStore } = {}) {
  const store = options.store ?? preferenceStore;
  const report = {
    mode: options.apply ? "apply" : "dry-run", modelVersion: ACTIVITY_PREFERENCE_MODEL_VERSION,
    scanned: { ecc: 0, hanhwal: 0, ratings: 0 }, validSourceEvents: 0, skippedMissingIdentityOrInvalid: 0,
    newEvents: 0, alreadyPresent: 0, profilesRecomputed: 0, errors: 0,
    unmappedActivities: [] as { source: string; activityId: string }[]
  };
  const mappings = new Map<string, ActivityMapping>();
  for await (const rows of preferencePages<ActivityMapping>("activity_preference_activity_map?select=id,source,activity_id,canonical_title,categories,tags,is_active", store)) {
    for (const row of rows) mappings.set(`${row.source}/${row.activity_id}`, row);
  }
  const lookup = (source: string, id: string) => mappings.get(`${source}/${id}`) ?? null;
  const users = new Set<string>();
  const unmapped = new Map<string, { source: string; activityId: string }>();
  let runId: string | undefined;
  if (options.apply) {
    const runs = await store<{ id: string }[]>("activity_preference_reconciliation_runs?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ model_version: ACTIVITY_PREFERENCE_MODEL_VERSION }) });
    runId = runs[0]?.id;
  }
  const ingest = async (event: PreferenceEvent | null, fromSource: boolean) => {
    if (!event) { report.skippedMissingIdentityOrInvalid++; return; }
    if (fromSource) report.validSourceEvents++;
    if (!event.categories.length && !event.tags.length) unmapped.set(`${event.source}/${event.activity_id}`, { source: event.source, activityId: event.activity_id });
    users.add(event.user_key);
    if (!options.apply) return;
    try {
      const result = await recordPreferenceEvent(event, store);
      if (fromSource) { if (result.inserted) report.newEvents++; else report.alreadyPresent++; }
    } catch { report.errors++; }
  };
  try {
    for (const adapter of [eccPreferenceAdapter, hanhwalPreferenceAdapter]) {
      for await (const rows of preferencePages<ApplicationSignalRow>(`${adapter.table}?select=${adapter.columns}`, store)) {
        for (const row of rows) {
          report.scanned[adapter.source as "ecc" | "hanhwal"]++;
          await ingest(adapter.toEvent(row, lookup(adapter.source, row.activity_id)), true);
        }
      }
    }
    for await (const rows of preferencePages<RatingSignalRow>(`${ratingPreferenceAdapter.table}?select=${ratingPreferenceAdapter.columns}&${ratingPreferenceAdapter.filter}`, store)) {
      for (const row of rows) { report.scanned.ratings++; await ingest(ratingPreferenceAdapter.toEvent(row, lookup(row.source, row.activity_id)), true); }
    }
    // Reclassify even events whose original application was reset by existing tools.
    // Event history is retained, while derived dimensions are fully replaceable.
    for await (const rows of preferencePages<PreferenceEvent>("activity_preference_events?select=id,user_key,source,activity_id,activity_instance_id,source_event_key,event_type,categories,tags,rating,base_weight,occurred_at,metadata", store)) {
      for (const row of rows) {
        const mapping = lookup(row.source, row.activity_id);
        const { id: _id, ...event } = row as PreferenceEvent & { id?: string };
        await ingest({ ...event, categories: mapping?.is_active ? mapping.categories : [], tags: mapping?.is_active ? mapping.tags : [],
          base_weight: event.event_type === "applied" ? preferenceConfig.appliedWeight : preferenceConfig.ratingWeights[event.rating!] }, false);
      }
    }
    if (options.apply) for (const user of users) {
      try { await recomputeUserActivityPreferences(user, store); report.profilesRecomputed++; }
      catch { report.errors++; }
    }
  } catch { report.errors++; }
  report.unmappedActivities = [...unmapped.values()].sort((a, b) => `${a.source}/${a.activityId}`.localeCompare(`${b.source}/${b.activityId}`));
  if (runId) await store(`activity_preference_reconciliation_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH", body: JSON.stringify({ status: report.errors ? "failed" : "completed", finished_at: new Date().toISOString(), summary: report })
  });
  return report;
}
