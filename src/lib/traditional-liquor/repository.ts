import type { Brewery, Offer, Platform, PriceHistory, Product, Seller, TraditionalLiquorDataset } from "@/lib/traditional-liquor/types";

export interface TraditionalLiquorRepository {
  getDataset(query?: string): Promise<TraditionalLiquorDataset>;
  searchProducts(query: string): Promise<Product[]>;
  searchPlatforms(query: string): Promise<Platform[]>;
  searchSellers(query: string): Promise<Seller[]>;
  searchBreweries(query: string): Promise<Brewery[]>;
  getProductDetail(productId: string): Promise<Product | null>;
  getProductOffers(productId: string): Promise<Offer[]>;
  getPlatformMarket(platformId: string): Promise<TraditionalLiquorDataset>;
  getSellerMarket(sellerId: string): Promise<TraditionalLiquorDataset>;
  getPriceHistory(offerId: string): Promise<PriceHistory[]>;
}
