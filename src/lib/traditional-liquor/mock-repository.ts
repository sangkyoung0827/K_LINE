import { traditionalLiquorMockData } from "@/lib/traditional-liquor/mock-data";
import type { TraditionalLiquorRepository } from "@/lib/traditional-liquor/repository";
import type { TraditionalLiquorDataset } from "@/lib/traditional-liquor/types";

function matches(values: string[], query: string) {
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  return !normalized || values.join(" ").toLocaleLowerCase("ko-KR").includes(normalized);
}

export class MockTraditionalLiquorRepository implements TraditionalLiquorRepository {
  async getDataset() {
    return structuredClone(traditionalLiquorMockData);
  }

  async searchProducts(query: string) {
    return structuredClone(traditionalLiquorMockData.products.filter((product) => matches([product.name, product.canonicalName, product.region, product.category], query)));
  }

  async searchPlatforms(query: string) {
    return structuredClone(traditionalLiquorMockData.platforms.filter((platform) => matches([platform.name, platform.code], query)));
  }

  async searchSellers(query: string) {
    return structuredClone(traditionalLiquorMockData.sellers.filter((seller) => matches([seller.name], query)));
  }

  async searchBreweries(query: string) {
    return structuredClone(traditionalLiquorMockData.breweries.filter((brewery) => matches([brewery.name, brewery.region, brewery.description], query)));
  }

  async getProductDetail(productId: string) {
    return structuredClone(traditionalLiquorMockData.products.find((product) => product.id === productId) ?? null);
  }

  async getProductOffers(productId: string) {
    return structuredClone(traditionalLiquorMockData.offers.filter((offer) => offer.productId === productId));
  }

  async getPlatformMarket(platformId: string): Promise<TraditionalLiquorDataset> {
    return this.filteredDataset((offer) => offer.platformId === platformId);
  }

  async getSellerMarket(sellerId: string): Promise<TraditionalLiquorDataset> {
    return this.filteredDataset((offer) => offer.sellerId === sellerId);
  }

  async getPriceHistory() {
    return [];
  }

  private filteredDataset(predicate: (offer: TraditionalLiquorDataset["offers"][number]) => boolean) {
    const offers = traditionalLiquorMockData.offers.filter(predicate);
    const productIds = new Set(offers.map((offer) => offer.productId));
    const platformIds = new Set(offers.map((offer) => offer.platformId));
    const sellerIds = new Set(offers.map((offer) => offer.sellerId));
    const products = traditionalLiquorMockData.products.filter((product) => productIds.has(product.id));
    const breweryIds = new Set(products.map((product) => product.breweryId));
    return Promise.resolve(structuredClone({
      breweries: traditionalLiquorMockData.breweries.filter((brewery) => breweryIds.has(brewery.id)),
      offers,
      platforms: traditionalLiquorMockData.platforms.filter((platform) => platformIds.has(platform.id)),
      products,
      sellers: traditionalLiquorMockData.sellers.filter((seller) => sellerIds.has(seller.id)),
      source: "mock" as const
    }));
  }
}
