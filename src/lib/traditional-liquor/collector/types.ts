import type { CollectorMetricType, CollectorPlatformCode } from "@/lib/traditional-liquor/collector/platform-registry";

export type CollectorMetricScope = "OFFER" | "CATALOG" | "PRODUCT";

export type CollectedMarketMetric = {
  type: CollectorMetricType;
  value: number;
  scope: CollectorMetricScope;
};

export type CollectedMarketItem = {
  identity: {
    externalOfferId?: string;
    sourceEntityId: string;
    metricScope: CollectorMetricScope;
  };
  product: {
    productName: string;
    sellerName?: string;
    brandName?: string;
    listingUrl?: string;
  };
  offer?: {
    price?: number;
    originalPrice?: number;
    benefitPrice?: number;
    shippingFee?: number;
    volumeMl?: number;
    quantity?: number;
  };
  metrics: CollectedMarketMetric[];
  provenance: {
    platformCode: CollectorPlatformCode;
    query: string;
    sourceUrl: string;
    collectedAt: string;
    collectorVersion: string;
  };
};

export type CollectorDiagnostics = {
  collectorVersion: string;
  platform: CollectorPlatformCode;
  pageUrl: string;
  query: string;
  scannedCount: number;
  collectedItems: number;
  skippedItems: number;
  offersCount: number;
  metricsCount: number;
  warnings: string[];
  errors: string[];
};

export type CollectorResultPayload = {
  version: "1";
  platformCode: CollectorPlatformCode;
  query: string;
  collectedAt: string;
  items: CollectedMarketItem[];
  diagnostics: CollectorDiagnostics;
};

export type CollectorJobStatus = "PENDING" | "DISPATCHED" | "RUNNING" | "UPLOADING" | "COMPLETED" | "FAILED" | "EXPIRED";

export type CollectorJobPublic = {
  id: string;
  platformCode: CollectorPlatformCode;
  query: string;
  status: CollectorJobStatus;
  targetUrl: string;
  expiresAt: string;
  batchId: string | null;
  diagnostics: CollectorDiagnostics | null;
  resultSummary: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
