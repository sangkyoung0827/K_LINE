import { affinityScore, evidenceConfidence, recencyDecay } from "./scoring";
import type { PreferenceDimension, PreferenceEvent } from "./types";

// Full weight goes to every assigned category/tag. Counts are per dimension,
// never summed across dimensions to obtain the user's total event count.
export function aggregatePreferenceEvents(events: PreferenceEvent[], asOf: string): PreferenceDimension[] {
  const groups = new Map<string, { dimension: PreferenceDimension; ratings: number }>();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.source_event_key)) continue;
    seen.add(event.source_event_key);
    for (const [type, keys] of [["category", event.categories], ["tag", event.tags]] as const) {
      for (const key of new Set(keys)) {
        const groupKey = `${type}/${key}`;
        const group = groups.get(groupKey) ?? { ratings: 0, dimension: {
          dimension_type: type, dimension_key: key, raw_score: 0, affinity_score: 50,
          confidence: 0, signal_count: 0, application_count: 0, rating_count: 0,
          average_rating: null, last_signal_at: null
        } };
        const d = group.dimension;
        d.raw_score += event.base_weight * recencyDecay(event.occurred_at, asOf);
        d.signal_count++;
        if (event.event_type === "applied") d.application_count++;
        else { d.rating_count++; group.ratings += event.rating!; }
        if (!d.last_signal_at || event.occurred_at > d.last_signal_at) d.last_signal_at = event.occurred_at;
        d.affinity_score = affinityScore(d.raw_score);
        d.confidence = evidenceConfidence(d.signal_count);
        d.average_rating = d.rating_count ? group.ratings / d.rating_count : null;
        groups.set(groupKey, group);
      }
    }
  }
  return [...groups.values()].map(({ dimension }) => dimension).sort((a, b) =>
    `${a.dimension_type}/${a.dimension_key}`.localeCompare(`${b.dimension_type}/${b.dimension_key}`));
}
