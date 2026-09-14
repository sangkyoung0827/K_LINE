import type { PreferenceCategory } from "./taxonomy";

export type PreferenceEventType = "applied" | "rating_submitted";
// Reserved only: the V1 writer/DB reject these until a separate model enables them.
export type FuturePreferenceEventType = "created_activity" | "saved_activity" | "explicit_preference";
export type ActivityMapping = {
  source: string;
  activity_id: string;
  canonical_title: string;
  categories: PreferenceCategory[];
  tags: string[];
  is_active: boolean;
};
export type PreferenceEvent = {
  user_key: string;
  source: string;
  activity_id: string;
  activity_instance_id: string | null;
  source_event_key: string;
  event_type: PreferenceEventType;
  categories: PreferenceCategory[];
  tags: string[];
  rating: number | null;
  base_weight: number;
  occurred_at: string;
  metadata: Record<string, never>;
};
export type PreferenceDimension = {
  dimension_type: "category" | "tag";
  dimension_key: string;
  raw_score: number;
  affinity_score: number;
  confidence: number;
  signal_count: number;
  application_count: number;
  rating_count: number;
  average_rating: number | null;
  last_signal_at: string | null;
};
export type ProfileDimension = {
  id: string;
  labelEn: string;
  labelKo: string;
  rawScore: number;
  affinity: number;
  confidence: number;
  signalCount: number;
  applicationCount: number;
  ratingCount: number;
  averageRating: number | null;
  lastSignalAt: string | null;
};
export type PreferenceProfile = {
  modelVersion: string;
  asOf: string;
  computedAt: string | null;
  categories: ProfileDimension[];
  tags: ProfileDimension[];
  stats: { applications: number; ratings: number; unmappedEvents: number };
};
export type ActivityCandidate = {
  source: string;
  activityId: string;
  title: string;
  categories: PreferenceCategory[];
  tags: string[];
  href?: string;
};
export type ApplicationSignalRow = {
  id: string;
  user_id: string | null;
  activity_id: string;
  activity_instance_id: string | null;
  created_at: string;
};
export type RatingSignalRow = {
  id: string;
  user_id: string;
  source: string;
  activity_id: string;
  activity_instance_id: string | null;
  rating: number | null;
  rated_at: string | null;
};
