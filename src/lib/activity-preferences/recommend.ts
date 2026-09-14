import "server-only";
import { getUserActivityPreferenceProfile } from "./server";
import type { ActivityCandidate, PreferenceProfile } from "./types";

export function rankWithPreferenceProfile(profile: PreferenceProfile, activities: ActivityCandidate[]) {
  return activities.map((activity) => {
    const category = [...new Set(activity.categories)].map((key) => profile.categories.find((d) => d.id === key));
    const tag = [...new Set(activity.tags)].map((key) => profile.tags.find((d) => d.id === key));
    const dimensions = [...category, ...tag];
    // Equal weight per unique dimension; missing evidence contributes neutral 0.
    const contribution = dimensions.reduce((sum, d) => sum + (d ? (d.affinity - 50) * d.confidence : 0), 0);
    const matchScore = 50 + (dimensions.length ? contribution / dimensions.length : 0);
    return { ...activity, matchScore, evidence: dimensions.filter((d) => d && d.confidence > 0).map((d) => ({
      id: d!.id, affinity: d!.affinity, confidence: d!.confidence
    })) };
  }).sort((a, b) => b.matchScore - a.matchScore || `${a.source}/${a.activityId}`.localeCompare(`${b.source}/${b.activityId}`));
}

export async function rankActivitiesForUser(userKey: string, activities: ActivityCandidate[]) {
  return rankWithPreferenceProfile(await getUserActivityPreferenceProfile(userKey), activities);
}
