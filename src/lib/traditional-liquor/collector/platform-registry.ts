import registryData from "@/lib/traditional-liquor/collector/platform-registry.json";

export type CollectorPlatformCode = "NAVER" | "KAKAO_GIFT";
export type CollectorMetricType = "PRICE" | "SOURCE_PURCHASE_COUNT" | "REVIEW_COUNT" | "KEEP_COUNT" | "WISH_COUNT" | "RATING" | "SEARCH_RANK";
export type CollectorMetricAvailability = "AVAILABLE" | "AVAILABLE_WHEN_PUBLIC" | "UNAVAILABLE";

export type CollectorPlatform = {
  code: CollectorPlatformCode;
  displayName: string;
  collector: "NAVER_SHOPPING" | "KAKAO_GIFT";
  targetUrlTemplate: string;
  metrics: Array<{
    type: CollectorMetricType;
    displayName: string;
    category: "OFFER" | "SALES" | "POPULARITY" | "RANK";
    availability: CollectorMetricAvailability;
    note?: string;
  }>;
};

export const collectorPlatforms = registryData as CollectorPlatform[];

export function getCollectorPlatform(code: unknown) {
  return collectorPlatforms.find((platform) => platform.code === code) ?? null;
}

export function buildCollectorTargetUrl(platform: CollectorPlatform, query: string) {
  return platform.targetUrlTemplate.replace("{query}", encodeURIComponent(query.trim()));
}
