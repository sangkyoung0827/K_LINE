import { ACTIVITY_PREFERENCE_MODEL_VERSION } from "./config";
import { affinityScore, recencyDecay } from "./scoring";
import { activityPreferenceTaxonomy } from "./taxonomy";
import type { PreferenceDimension, PreferenceProfile, ProfileDimension } from "./types";

export type StoredProfile = {
  state: { application_count: number; rating_count: number; unmapped_count: number; model_version: string; computed_at: string | null } | null;
  dimensions: PreferenceDimension[];
};

export function toPreferenceProfile(stored: StoredProfile, now: string): PreferenceProfile {
  const computedAt = stored.state?.computed_at ?? null;
  const factor = computedAt ? recencyDecay(computedAt, now) : 1;
  const format = (id: string, labelEn: string, labelKo: string, row?: PreferenceDimension): ProfileDimension => ({
    id, labelEn, labelKo, rawScore: Number(row?.raw_score ?? 0) * factor,
    affinity: affinityScore(Number(row?.raw_score ?? 0) * factor), confidence: Number(row?.confidence ?? 0),
    signalCount: row?.signal_count ?? 0, applicationCount: row?.application_count ?? 0,
    ratingCount: row?.rating_count ?? 0, averageRating: row?.average_rating == null ? null : Number(row.average_rating),
    lastSignalAt: row?.last_signal_at ?? null
  });
  return {
    modelVersion: stored.state?.model_version ?? ACTIVITY_PREFERENCE_MODEL_VERSION,
    asOf: now, computedAt,
    categories: activityPreferenceTaxonomy.map(({ id, labelEn, labelKo }) => format(id, labelEn, labelKo,
      stored.dimensions.find((d) => d.dimension_type === "category" && d.dimension_key === id))),
    tags: stored.dimensions.filter((d) => d.dimension_type === "tag").map((d) => format(d.dimension_key, d.dimension_key, d.dimension_key, d)),
    stats: { applications: stored.state?.application_count ?? 0, ratings: stored.state?.rating_count ?? 0, unmappedEvents: stored.state?.unmapped_count ?? 0 }
  };
}
