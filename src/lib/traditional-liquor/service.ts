import type { TraditionalLiquorRepository } from "@/lib/traditional-liquor/repository";
import type { PlatformResult, ProductResult, SellerResult, TraditionalLiquorDataset, TraditionalLiquorSearchResult } from "@/lib/traditional-liquor/types";

function includesQuery(values: Array<string | number>, query: string) {
  if (!query) return true;
  const haystack = values.join(" ").toLocaleLowerCase("ko-KR");
  return haystack.includes(query.toLocaleLowerCase("ko-KR"));
}

export class TraditionalLiquorDataService {
  constructor(private readonly repository: TraditionalLiquorRepository) {}

  async search(rawQuery = ""): Promise<TraditionalLiquorSearchResult> {
    const data = await this.repository.getDataset();
    const query = rawQuery.trim();
    const products = this.productResults(data).filter((product) => includesQuery([
      product.name, product.canonicalName, product.region, product.category, product.subCategory,
      product.brewery?.name ?? "", product.brewery?.region ?? "",
      ...product.offers.flatMap((offer) => [offer.platform?.name ?? "", offer.seller?.name ?? "", offer.listingTitle])
    ], query));
    const platforms = this.platformResults(data).filter((platform) => includesQuery([
      platform.name, platform.code,
      ...platform.offers.flatMap((offer) => [offer.product?.name ?? "", offer.seller?.name ?? "", offer.listingTitle])
    ], query));
    const sellers = this.sellerResults(data).filter((seller) => includesQuery([
      seller.name,
      ...seller.offers.flatMap((offer) => [offer.product?.name ?? "", offer.platform?.name ?? "", offer.listingTitle])
    ], query));
    const breweries = data.breweries.filter((brewery) => includesQuery([brewery.name, brewery.region, brewery.description], query));
    return { breweries, platforms, products, sellers, source: data.source };
  }

  private productResults(data: TraditionalLiquorDataset): ProductResult[] {
    return data.products.map((product) => ({
      ...product,
      brewery: data.breweries.find((brewery) => brewery.id === product.breweryId) ?? null,
      offers: data.offers.filter((offer) => offer.productId === product.id).map((offer) => ({
        ...offer,
        platform: data.platforms.find((platform) => platform.id === offer.platformId) ?? null,
        seller: data.sellers.find((seller) => seller.id === offer.sellerId) ?? null
      })).sort((left, right) => left.price - right.price)
    }));
  }

  private platformResults(data: TraditionalLiquorDataset): PlatformResult[] {
    return data.platforms.map((platform) => {
      const offers = data.offers.filter((offer) => offer.platformId === platform.id).map((offer) => ({
        ...offer,
        product: data.products.find((product) => product.id === offer.productId) ?? null,
        seller: data.sellers.find((seller) => seller.id === offer.sellerId) ?? null
      })).sort((left, right) => left.price - right.price);
      return { ...platform, offers, productCount: new Set(offers.map((offer) => offer.productId)).size, sellerCount: new Set(offers.map((offer) => offer.sellerId)).size };
    });
  }

  private sellerResults(data: TraditionalLiquorDataset): SellerResult[] {
    return data.sellers.map((seller) => {
      const offers = data.offers.filter((offer) => offer.sellerId === seller.id).map((offer) => ({
        ...offer,
        platform: data.platforms.find((platform) => platform.id === offer.platformId) ?? null,
        product: data.products.find((product) => product.id === offer.productId) ?? null
      })).sort((left, right) => left.price - right.price);
      return {
        ...seller,
        averagePrice: offers.length ? Math.round(offers.reduce((sum, offer) => sum + offer.price, 0) / offers.length) : null,
        offers,
        platformCount: new Set(offers.map((offer) => offer.platformId)).size,
        productCount: new Set(offers.map((offer) => offer.productId)).size
      };
    });
  }
}
