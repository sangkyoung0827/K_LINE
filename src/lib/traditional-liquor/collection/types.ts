export type CollectionSourceType = "BROWSER" | "API" | "FILE" | "MANUAL" | "FIXTURE";
export type CollectionQueryType = "GENERAL" | "CATEGORY" | "PRODUCT" | "BRAND" | "BREWERY" | "DISCOVERY";

export interface RawCollectedOffer {
  sourceType: CollectionSourceType;
  sourceName: string;
  platformCode?: string;
  query?: string;
  externalOfferId?: string | null;
  listingTitle: string;
  sellerName?: string | null;
  priceText?: string | null;
  originalPriceText?: string | null;
  shippingText?: string | null;
  volumeText?: string | null;
  quantityText?: string | null;
  abvText?: string | null;
  stockText?: string | null;
  ratingText?: string | null;
  reviewCountText?: string | null;
  listingUrl?: string | null;
  imageUrl?: string | null;
  collectedAt: string;
  rawPayload: unknown;
}

export interface NormalizedOffer {
  sourceName: string;
  platformCode?: string;
  query?: string;
  externalOfferId?: string | null;
  listingTitle: string;
  normalizedListingTitle: string;
  sellerName?: string | null;
  normalizedSellerName?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  shippingFee?: number | null;
  listingVolumeMl?: number | null;
  quantity?: number | null;
  totalVolumeMl?: number | null;
  abv?: number | null;
  stockStatus?: string | null;
  reviewCount?: number | null;
  rating?: number | null;
  listingUrl?: string | null;
  collectedAt: string;
}

export interface CollectionQuery {
  id: string;
  query: string;
  queryType: CollectionQueryType;
  priority: number;
  enabled: boolean;
  lastCollectedAt?: string | null;
}

export type ValidationCode = "MISSING_LISTING_TITLE" | "INVALID_PRICE" | "INVALID_URL" | "UNKNOWN_PLATFORM";

export interface ValidationIssue {
  code: ValidationCode;
  field: string;
  message: string;
  rawValue?: string | null;
  severity: "ERROR" | "WARNING";
}

export interface ValidatedOffer {
  raw: RawCollectedOffer;
  normalized: NormalizedOffer;
  status: "VALID" | "INVALID";
  issues: ValidationIssue[];
}

export interface CollectionResult {
  batchId: string;
  sourceName: string;
  query: CollectionQuery;
  total: number;
  valid: number;
  invalid: number;
  status: "READY" | "FAILED";
}

export interface QueryCandidate {
  query: string;
  queryType: CollectionQueryType;
  reason: string;
  approved: false;
}
