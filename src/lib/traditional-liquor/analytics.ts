import "server-only";

import type {
  TraditionalLiquorAnalyticsPlatform,
  TraditionalLiquorMetricPeriod,
  TraditionalLiquorMetricType,
  TraditionalLiquorPagedResult,
  TraditionalLiquorPriceRow,
  TraditionalLiquorPriceSort,
  TraditionalLiquorSalesRow
} from "@/lib/traditional-liquor/types";
import { supabaseRequest } from "@/lib/supabaseServer";

const PRICE_SORTS = new Set<TraditionalLiquorPriceSort>(["LOWEST", "HIGHEST", "PER_100ML"]);
const METRICS = new Set<TraditionalLiquorMetricType>([
  "SOURCE_PURCHASE_COUNT", "KEEP_COUNT", "REVIEW_COUNT", "WISH_COUNT",
  "SEARCH_RANK", "GIFT_RANK", "CATEGORY_RANK"
]);
const PERIODS = new Set<TraditionalLiquorMetricPeriod>(["LATEST", "7D", "30D", "HISTORY"]);

type PriceRpcRow = {
  offer_id: string; product_name: string; platform_code: string; platform_name: string;
  seller_name: string; price: number; total_volume_ml: number | null;
  price_per_100ml: number | null; last_checked_at: string | null; total_count: number;
};
type SalesRpcRow = {
  product_id?: string; offer_id: string; product_name: string; platform_code: string; platform_name: string;
  seller_name: string; metric_type: TraditionalLiquorMetricType; latest_value: number;
  latest_observed_at: string; baseline_value: number | null; baseline_observed_at: string | null;
  delta_value: number | null; delta_percent?: number | null; history_count: number; total_count: number;
  metric_scope?: "OFFER" | "PRODUCT" | "CATALOG"; source_entity_id?: string;
  period?: TraditionalLiquorMetricPeriod; data_status?: "AVAILABLE" | "INSUFFICIENT_DATA" | "NO_CURRENT_DATA";
  history_points?: Array<{ observed_at: string; metric_value: number }> | null;
  seven_day_available_count?: number; thirty_day_available_count?: number; trend_available_count?: number;
};
type PlatformRow = { code: string; name: string };

export type PriceAnalyticsInput = {
  query?: string; platform?: string; minPrice?: number | null; maxPrice?: number | null;
  sort?: TraditionalLiquorPriceSort; page?: number; limit?: number;
};
export type SalesAnalyticsInput = {
  query?: string; platform?: string; metric?: TraditionalLiquorMetricType;
  period?: TraditionalLiquorMetricPeriod; page?: number; limit?: number;
};

function positiveInteger(value: number | undefined, fallback: number, maximum: number) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.trunc(value as number))) : fallback;
}

function cleanQuery(value?: string) {
  return value?.trim().slice(0, 120) || null;
}

export class TraditionalLiquorAnalyticsService {
  async getPriceAnalytics(input: PriceAnalyticsInput): Promise<TraditionalLiquorPagedResult<TraditionalLiquorPriceRow>> {
    const page = positiveInteger(input.page, 1, 100000);
    const limit = positiveInteger(input.limit, 50, 50);
    const sort = input.sort && PRICE_SORTS.has(input.sort) ? input.sort : "LOWEST";
    const rows = await supabaseRequest<PriceRpcRow[]>("rpc/get_traditional_liquor_price_analytics", {
      method: "POST",
      body: JSON.stringify({
        p_query: cleanQuery(input.query), p_platform_code: cleanQuery(input.platform),
        p_min_price: input.minPrice ?? null, p_max_price: input.maxPrice ?? null,
        p_sort: sort, p_offset: (page - 1) * limit, p_limit: limit
      })
    });
    const total = Number(rows[0]?.total_count ?? 0);
    return {
      rows: rows.map((row) => ({
        offerId: row.offer_id, productName: row.product_name, platformCode: row.platform_code,
        platformName: row.platform_name, sellerName: row.seller_name, price: Number(row.price),
        totalVolumeMl: row.total_volume_ml === null ? null : Number(row.total_volume_ml),
        pricePer100ml: row.price_per_100ml === null ? null : Number(row.price_per_100ml),
        lastCheckedAt: row.last_checked_at
      })),
      platforms: await this.getPlatforms(), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit))
    };
  }

  async getSalesAnalytics(input: SalesAnalyticsInput): Promise<TraditionalLiquorPagedResult<TraditionalLiquorSalesRow>> {
    const page = positiveInteger(input.page, 1, 100000);
    const limit = positiveInteger(input.limit, 50, 50);
    const metric = input.metric && METRICS.has(input.metric) ? input.metric : "SOURCE_PURCHASE_COUNT";
    const period = input.period && PERIODS.has(input.period) ? input.period : "LATEST";
    const rows = await supabaseRequest<SalesRpcRow[]>("rpc/get_traditional_liquor_sales_analytics", {
      method: "POST",
      body: JSON.stringify({
        p_query: cleanQuery(input.query), p_platform_code: cleanQuery(input.platform),
        p_metric_type: metric, p_period: period, p_offset: (page - 1) * limit, p_limit: limit
      })
    });
    const total = Number(rows[0]?.total_count ?? 0);
    const hasAvailabilitySummary = rows[0]?.seven_day_available_count !== undefined;
    const fallbackAvailability = hasAvailabilitySummary
      ? null
      : await this.getLegacySalesAvailability(input, metric);
    return {
      rows: rows.map((row) => ({
        productId: row.product_id ?? "", offerId: row.offer_id, productName: row.product_name, platformCode: row.platform_code,
        platformName: row.platform_name, sellerName: row.seller_name, metricType: row.metric_type,
        metricScope: row.metric_scope ?? "OFFER", sourceEntityId: row.source_entity_id ?? row.offer_id,
        period: row.period ?? period,
        dataStatus: row.data_status ?? (period === "LATEST" || row.baseline_value !== null || (period === "HISTORY" && Number(row.history_count) >= 2) ? "AVAILABLE" : "INSUFFICIENT_DATA"),
        latestValue: Number(row.latest_value), latestObservedAt: row.latest_observed_at,
        baselineValue: row.baseline_value === null ? null : Number(row.baseline_value),
        baselineObservedAt: row.baseline_observed_at,
        deltaValue: row.delta_value === null ? null : Number(row.delta_value),
        deltaPercent: row.delta_percent == null ? calculateDeltaPercent(row.latest_value, row.baseline_value) : Number(row.delta_percent),
        historyCount: Number(row.history_count),
        history: (row.history_points ?? []).map((point, index, points) => ({
          observedAt: point.observed_at,
          value: Number(point.metric_value),
          deltaFromPrevious: index === 0 ? null : Number(point.metric_value) - Number(points[index - 1].metric_value)
        }))
      })),
      platforms: await this.getPlatforms(), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      availability: {
        latest: total > 0,
        sevenDays: hasAvailabilitySummary ? Number(rows[0]?.seven_day_available_count ?? 0) > 0 : Boolean(fallbackAvailability?.sevenDays),
        thirtyDays: hasAvailabilitySummary ? Number(rows[0]?.thirty_day_available_count ?? 0) > 0 : Boolean(fallbackAvailability?.thirtyDays),
        history: hasAvailabilitySummary ? Number(rows[0]?.trend_available_count ?? 0) > 0 : Boolean(fallbackAvailability?.history)
      }
    };
  }

  private async getLegacySalesAvailability(input: SalesAnalyticsInput, metric: TraditionalLiquorMetricType) {
    const request = (period: TraditionalLiquorMetricPeriod) => supabaseRequest<SalesRpcRow[]>("rpc/get_traditional_liquor_sales_analytics", {
      method: "POST",
      body: JSON.stringify({
        p_query: cleanQuery(input.query), p_platform_code: cleanQuery(input.platform),
        p_metric_type: metric, p_period: period, p_offset: 0, p_limit: 50
      })
    });
    const [sevenDays, thirtyDays, history] = await Promise.all([request("7D"), request("30D"), request("HISTORY")]);
    return {
      sevenDays: sevenDays.some((row) => row.baseline_value !== null),
      thirtyDays: thirtyDays.some((row) => row.baseline_value !== null),
      history: history.some((row) => Number(row.history_count) >= 2)
    };
  }

  private async getPlatforms(): Promise<TraditionalLiquorAnalyticsPlatform[]> {
    return supabaseRequest<PlatformRow[]>(
      "traditional_liquor_platforms?select=code,name&is_active=eq.true&order=name.asc&limit=100"
    );
  }
}

function calculateDeltaPercent(latest: number, baseline: number | null) {
  if (baseline === null || Number(baseline) === 0) return null;
  return Math.round(((Number(latest) - Number(baseline)) / Number(baseline)) * 10_000) / 100;
}

export function parseOptionalPrice(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

export function parsePage(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

export function parsePriceSort(value: string | null): TraditionalLiquorPriceSort {
  return value && PRICE_SORTS.has(value as TraditionalLiquorPriceSort) ? value as TraditionalLiquorPriceSort : "LOWEST";
}

export function parseMetric(value: string | null): TraditionalLiquorMetricType {
  return value && METRICS.has(value as TraditionalLiquorMetricType) ? value as TraditionalLiquorMetricType : "SOURCE_PURCHASE_COUNT";
}

export function parsePeriod(value: string | null): TraditionalLiquorMetricPeriod {
  return value && PERIODS.has(value as TraditionalLiquorMetricPeriod) ? value as TraditionalLiquorMetricPeriod : "LATEST";
}
