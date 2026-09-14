import "server-only";
import { getEccActivityCatalog } from "@/lib/eccOperations";
import { hanhwalActivityTitles, type HanhwalActivityType } from "@/lib/hanhwalActivities";
import { preferenceConfig } from "./config";
import { getUserActivityPreferenceProfile } from "./server";
import { rankWithPreferenceProfile } from "./recommend";
import { preferenceStore, logPreferenceFailure } from "./store";
import { isActivityPreferenceRequest, activityPreferenceAnswerRules } from "./intent";
import type { ActivityCandidate, ActivityMapping, PreferenceProfile } from "./types";

export function summarizePreferenceProfile(profile: PreferenceProfile) {
  const compact = (d: PreferenceProfile["categories"][number]) => ({
    category: d.id, labelEn: d.labelEn, labelKo: d.labelKo,
    affinity: d.affinity, confidence: d.confidence, applicationCount: d.applicationCount,
    ratingCount: d.ratingCount, averageRating: d.averageRating
  });
  const ranked = [...profile.categories].sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id));
  return {
    modelVersion: profile.modelVersion, asOf: profile.asOf, computedAt: profile.computedAt,
    strongestCategories: ranked.filter((d) => d.affinity > 50 && d.confidence >= preferenceConfig.strongConfidence).slice(0, 5).map(compact),
    emergingCategories: ranked.filter((d) => d.affinity > 50 && d.confidence > 0 && d.confidence < preferenceConfig.strongConfidence).slice(0, 5).map(compact),
    lowerAffinityCategories: ranked.filter((d) => d.affinity < 50 && d.confidence > 0).map(compact),
    neutralCategories: ranked.filter((d) => d.affinity === 50 && d.confidence > 0).map(compact),
    insufficientData: ranked.filter((d) => d.confidence === 0).map((d) => d.id),
    topTags: [...profile.tags].filter((d) => d.confidence > 0).sort((a, b) => b.affinity - a.affinity).slice(0, 8).map(compact),
    stats: profile.stats
  };
}

async function openActivityCandidates(): Promise<ActivityCandidate[]> {
  const candidates: ActivityCandidate[] = [];
  const signal = AbortSignal.timeout(preferenceConfig.candidatesTimeoutMs);
  const readSource = async (source: "ecc" | "hanhwal") => {
    const [statuses, mappings] = await Promise.all([
      preferenceStore<{ activity_id: string; is_open: boolean; gathering_open_days?: string[] }[]>(
        `${source}_activity_statuses?select=activity_id,is_open${source === "ecc" ? ",gathering_open_days" : ""}&is_open=eq.true`, { signal }),
      preferenceStore<ActivityMapping[]>(`activity_preference_activity_map?select=source,activity_id,canonical_title,categories,tags,is_active&source=eq.${source}&is_active=eq.true`, { signal })
    ]);
    return { source, statuses, mappings };
  };
  const [catalog, ecc, hanhwal] = await Promise.all([getEccActivityCatalog(), readSource("ecc"), readSource("hanhwal")]);
  signal.throwIfAborted();
  for (const { source, statuses, mappings } of [ecc, hanhwal]) {
    for (const status of statuses) {
      if (source === "ecc" && status.activity_id === "gathering" && !status.gathering_open_days?.length) continue;
      const entry = catalog.find((item) => item.id === status.activity_id && !item.archived);
      const title = source === "ecc" ? entry?.titleEn : hanhwalActivityTitles[status.activity_id as HanhwalActivityType];
      if (!title) continue;
      const mapping = mappings.find((item) => item.activity_id === status.activity_id);
      candidates.push({ source, activityId: status.activity_id, title,
        categories: mapping?.categories ?? [], tags: mapping?.tags ?? [], href: `/our-activities/${source}/activity` });
    }
  }
  return candidates;
}

async function withPreferenceDeadline<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("PREFERENCE_SUMMARY_TIMEOUT")), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

export async function getActivityPreferenceSummaryForWoohyukmon(userKey: string) {
  const profile = await withPreferenceDeadline(getUserActivityPreferenceProfile(userKey), preferenceConfig.summaryTimeoutMs);
  let candidates: ActivityCandidate[] = [];
  let candidatesReady = true;
  // Optional catalog delays must not discard an already loaded private profile.
  try { candidates = await withPreferenceDeadline(openActivityCandidates(), preferenceConfig.candidatesTimeoutMs); }
  catch { candidatesReady = false; logPreferenceFailure("candidates"); }
  return { ...summarizePreferenceProfile(profile), candidatesReady,
    openApplicationRecommendations: rankWithPreferenceProfile(profile, candidates).slice(0, 6),
    scheduleVerified: false, membershipStillRequired: true };
}

export async function activityPreferenceContextForMessage(message: string, userKey?: string | null) {
  if (!isActivityPreferenceRequest(message)) return { text: "", ready: false };
  if (!userKey) return { text: `${activityPreferenceAnswerRules}\nActivity preference status: login required; do not invent a profile.`, ready: false };
  try {
    const summary = await getActivityPreferenceSummaryForWoohyukmon(userKey);
    return { text: `${activityPreferenceAnswerRules}\nPrivate calculated activity-interest context:\n${JSON.stringify(summary)}`, ready: true };
  } catch {
    logPreferenceFailure("assistant-summary");
    return { text: `${activityPreferenceAnswerRules}\nActivity preference status: temporarily unavailable, NOT zero evidence. Explain this limitation; do not fabricate personal interests.`, ready: false };
  }
}
