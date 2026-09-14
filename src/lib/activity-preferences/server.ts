import "server-only";
import { ACTIVITY_PREFERENCE_MODEL_VERSION, preferenceConfig } from "./config";
import { normalizePreferenceUserKey } from "./identity";
import { toPreferenceProfile, type StoredProfile } from "./profile";
import { preferenceStore, type PreferenceStore } from "./store";

export async function recomputeUserActivityPreferences(userKey: string, store: PreferenceStore = preferenceStore) {
  const key = normalizePreferenceUserKey(userKey);
  if (!key) throw new Error("PREFERENCE_USER_REQUIRED");
  await store("rpc/recompute_activity_preferences", { method: "POST", body: JSON.stringify({
    p_user_key: key, p_as_of: new Date().toISOString(), p_model_version: ACTIVITY_PREFERENCE_MODEL_VERSION,
    p_half_life_days: preferenceConfig.halfLifeDays, p_affinity_scale: preferenceConfig.affinityScale,
    p_confidence_scale: preferenceConfig.confidenceScale
  }) });
}

export async function getUserActivityPreferenceProfile(userKey: string, store: PreferenceStore = preferenceStore) {
  const key = normalizePreferenceUserKey(userKey);
  if (!key) throw new Error("PREFERENCE_USER_REQUIRED");
  // This STABLE RPC reads only precomputed data in one coherent DB snapshot.
  const stored = await store<StoredProfile>(`rpc/read_activity_preference_profile?p_user_key=${encodeURIComponent(key)}`);
  return toPreferenceProfile(stored, new Date().toISOString());
}
