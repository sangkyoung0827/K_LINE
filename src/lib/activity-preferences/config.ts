export const ACTIVITY_PREFERENCE_MODEL_VERSION = "v1";
export const preferenceConfig = {
  appliedWeight: 2,
  ratingWeights: { 1: -3, 2: -1, 3: 0, 4: 2, 5: 4 } as Record<number, number>,
  halfLifeDays: 180,
  affinityScale: 10,
  confidenceScale: 4,
  strongConfidence: 0.7,
  requestTimeoutMs: 8_000,
  summaryTimeoutMs: 5_000,
  candidatesTimeoutMs: 2_500,
  pageSize: 500
} as const;
