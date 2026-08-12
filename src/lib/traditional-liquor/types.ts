export type TraditionalLiquorView = "product" | "platform" | "seller" | "price" | "sales";

export type TraditionalLiquorAnalyticsView =
  | "OVERVIEW"
  | "PRODUCT"
  | "PLATFORM"
  | "SELLER"
  | "PRICE"
  | "SALES";

export type TraditionalLiquorAnalyticsFilters = {
  query?: string;
  platformCode?: string;
  sellerId?: string;
  sellerName?: string;
  productId?: string;
  productName?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: TraditionalLiquorPriceSort;
  metricType?: TraditionalLiquorMetricType;
  period?: TraditionalLiquorMetricPeriod;
};

export type TraditionalLiquorAnalyticsResponse = {
  type: "TRADITIONAL_LIQUOR_ANALYTICS";
  view: TraditionalLiquorAnalyticsView;
  filters?: TraditionalLiquorAnalyticsFilters;
};

export type TraditionalLiquorPriceSort = "LOWEST" | "HIGHEST" | "PER_100ML";
export type TraditionalLiquorMetricType =
  | "SOURCE_PURCHASE_COUNT"
  | "KEEP_COUNT"
  | "REVIEW_COUNT"
  | "WISH_COUNT"
  | "SEARCH_RANK"
  | "GIFT_RANK"
  | "CATEGORY_RANK";
export type TraditionalLiquorMetricPeriod = "LATEST" | "7D" | "30D" | "HISTORY";
export type TraditionalLiquorMetricDataStatus = "AVAILABLE" | "INSUFFICIENT_DATA" | "NO_CURRENT_DATA";

export type TraditionalLiquorMetricPoint = {
  observedAt: string;
  value: number;
  deltaFromPrevious: number | null;
};

export type TraditionalLiquorSalesAvailability = {
  latest: boolean;
  sevenDays: boolean;
  thirtyDays: boolean;
  history: boolean;
};

export type TraditionalLiquorAnalyticsPlatform = {
  code: string;
  name: string;
};

export type TraditionalLiquorPriceRow = {
  offerId: string;
  productName: string;
  platformCode: string;
  platformName: string;
  sellerName: string;
  price: number;
  totalVolumeMl: number | null;
  pricePer100ml: number | null;
  lastCheckedAt: string | null;
};

export type TraditionalLiquorSalesRow = {
  productId: string;
  offerId: string;
  productName: string;
  platformCode: string;
  platformName: string;
  sellerName: string;
  metricType: TraditionalLiquorMetricType;
  metricScope: "OFFER" | "PRODUCT" | "CATALOG";
  sourceEntityId: string;
  period: TraditionalLiquorMetricPeriod;
  dataStatus: TraditionalLiquorMetricDataStatus;
  latestValue: number;
  latestObservedAt: string;
  baselineValue: number | null;
  baselineObservedAt: string | null;
  deltaValue: number | null;
  deltaPercent: number | null;
  historyCount: number;
  history: TraditionalLiquorMetricPoint[];
};

export type TraditionalLiquorPagedResult<T> = {
  rows: T[];
  platforms: TraditionalLiquorAnalyticsPlatform[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  availability?: TraditionalLiquorSalesAvailability;
};

export type TraditionalLiquorEntityType = "PRODUCT" | "PLATFORM" | "SELLER" | "BREWERY";

export type TraditionalLiquorQueryIntent =
  | "OPEN_TRADITIONAL_LIQUOR_DATABASE"
  | "TRADITIONAL_LIQUOR_DATABASE_OVERVIEW"
  | "TRADITIONAL_LIQUOR_PRODUCT_VIEW"
  | "TRADITIONAL_LIQUOR_PLATFORM_VIEW"
  | "TRADITIONAL_LIQUOR_SELLER_VIEW"
  | "TRADITIONAL_LIQUOR_PRICE_VIEW"
  | "TRADITIONAL_LIQUOR_SALES_VIEW"
  | "TRADITIONAL_LIQUOR_PRODUCT_SEARCH"
  | "TRADITIONAL_LIQUOR_PLATFORM_SEARCH"
  | "TRADITIONAL_LIQUOR_SELLER_SEARCH"
  | "TRADITIONAL_LIQUOR_BREWERY_SEARCH"
  | "TRADITIONAL_LIQUOR_MARKET_QUERY";

export type Brewery = {
  id: string;
  name: string;
  region: string;
  description: string;
};

export type Product = {
  id: string;
  name: string;
  canonicalName: string;
  breweryId: string;
  region: string;
  category: string;
  subCategory: string;
  abv: number;
  volumeMl: number;
  description: string;
};

export type Platform = {
  id: string;
  name: string;
  code: string;
};

export type Seller = {
  id: string;
  name: string;
};

export type Offer = {
  id: string;
  productId: string;
  platformId: string;
  sellerId: string;
  listingTitle: string;
  price: number;
  originalPrice: number | null;
  volumeMl: number;
  quantity: number;
  shippingFee: number;
  url: string | null;
  lastCheckedAt: string;
};

export type PriceHistory = {
  id: string;
  offerId: string;
  observedAt: string;
  price: number | null;
  originalPrice: number | null;
  shippingFee: number | null;
  stockStatus: string | null;
  reviewCount: number | null;
  rating: number | null;
};

export type TraditionalLiquorDataset = {
  breweries: Brewery[];
  offers: Offer[];
  platforms: Platform[];
  products: Product[];
  sellers: Seller[];
  source: "mock" | "postgresql" | "api";
};

export type ProductResult = Product & {
  brewery: Brewery | null;
  offers: Array<Offer & { platform: Platform | null; seller: Seller | null }>;
};

export type PlatformResult = Platform & {
  offers: Array<Offer & { product: Product | null; seller: Seller | null }>;
  productCount: number;
  sellerCount: number;
};

export type SellerResult = Seller & {
  averagePrice: number | null;
  offers: Array<Offer & { platform: Platform | null; product: Product | null }>;
  platformCount: number;
  productCount: number;
};

export type TraditionalLiquorSearchResult = {
  breweries: Brewery[];
  platforms: PlatformResult[];
  products: ProductResult[];
  sellers: SellerResult[];
  source: TraditionalLiquorDataset["source"];
};
