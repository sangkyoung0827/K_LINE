export type TraditionalLiquorView = "product" | "platform" | "seller";

export type TraditionalLiquorEntityType = "PRODUCT" | "PLATFORM" | "SELLER" | "BREWERY";

export type TraditionalLiquorQueryIntent =
  | "OPEN_TRADITIONAL_LIQUOR_DATABASE"
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

export type TraditionalLiquorDataset = {
  breweries: Brewery[];
  offers: Offer[];
  platforms: Platform[];
  products: Product[];
  sellers: Seller[];
  source: "mock" | "api";
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

