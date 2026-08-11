import "server-only";

import type { TraditionalLiquorRepository } from "@/lib/traditional-liquor/repository";
import type { Brewery, Offer, Platform, PriceHistory, Product, Seller, TraditionalLiquorDataset } from "@/lib/traditional-liquor/types";
import { supabaseRequest } from "@/lib/supabaseServer";

type MarketRow = {
  product_id: string;
  product_name: string;
  canonical_name: string | null;
  product_normalized_name: string | null;
  product_region: string | null;
  category: string | null;
  sub_category: string | null;
  abv: number | null;
  volume_ml: number | null;
  product_description: string | null;
  brewery_id: string | null;
  brewery_name: string | null;
  brewery_normalized_name: string | null;
  brewery_region: string | null;
  brewery_description: string | null;
  platform_id: string;
  platform_code: string;
  platform_name: string;
  seller_id: string;
  seller_name: string;
  seller_normalized_name: string | null;
  offer_id: string;
  listing_title: string | null;
  listing_url: string | null;
  price: number;
  original_price: number | null;
  shipping_fee: number | null;
  quantity: number;
  listing_volume_ml: number | null;
  last_checked_at: string | null;
};

type BreweryRow = { id: string; name: string; region: string | null; description: string | null };
type ProductRow = { id: string; brewery_id: string | null; name: string; canonical_name: string | null; region: string | null; category: string | null; sub_category: string | null; abv: number | null; volume_ml: number | null; description: string | null };
type PlatformRow = { id: string; name: string; code: string };
type SellerRow = { id: string; name: string };
type OfferRow = { id: string; product_id: string; platform_id: string; seller_id: string; listing_title: string | null; listing_url: string | null; price: number; original_price: number | null; listing_volume_ml: number | null; quantity: number; shipping_fee: number | null; last_checked_at: string | null };
type PriceHistoryRow = { id: string; offer_id: string; observed_at: string; price: number | null; original_price: number | null; shipping_fee: number | null; stock_status: string | null; review_count: number | null; rating: number | null };

function encoded(value: string) {
  return encodeURIComponent(value);
}

function queryPattern(value: string) {
  return encoded(`*${value.replace(/[*,()]/g, " ").trim()}*`);
}

function marketRowsToDataset(rows: MarketRow[]): TraditionalLiquorDataset {
  const breweries = new Map<string, Brewery>();
  const products = new Map<string, Product>();
  const platforms = new Map<string, Platform>();
  const sellers = new Map<string, Seller>();
  const offers = new Map<string, Offer>();

  rows.forEach((row) => {
    if (row.brewery_id && row.brewery_name) breweries.set(row.brewery_id, { id: row.brewery_id, name: row.brewery_name, region: row.brewery_region ?? "", description: row.brewery_description ?? "" });
    products.set(row.product_id, { id: row.product_id, name: row.product_name, canonicalName: row.canonical_name ?? row.product_name, breweryId: row.brewery_id ?? "", region: row.product_region ?? "", category: row.category ?? "", subCategory: row.sub_category ?? "", abv: Number(row.abv ?? 0), volumeMl: Number(row.volume_ml ?? 0), description: row.product_description ?? "" });
    platforms.set(row.platform_id, { id: row.platform_id, name: row.platform_name, code: row.platform_code });
    sellers.set(row.seller_id, { id: row.seller_id, name: row.seller_name });
    offers.set(row.offer_id, { id: row.offer_id, productId: row.product_id, platformId: row.platform_id, sellerId: row.seller_id, listingTitle: row.listing_title ?? "", price: Number(row.price), originalPrice: row.original_price === null ? null : Number(row.original_price), volumeMl: Number(row.listing_volume_ml ?? row.volume_ml ?? 0), quantity: Number(row.quantity), shippingFee: Number(row.shipping_fee ?? 0), url: row.listing_url, lastCheckedAt: row.last_checked_at ?? "" });
  });

  return { breweries: [...breweries.values()], products: [...products.values()], platforms: [...platforms.values()], sellers: [...sellers.values()], offers: [...offers.values()], source: "postgresql" };
}

export class PostgreSQLTraditionalLiquorRepository implements TraditionalLiquorRepository {
  async getDataset(query = "") {
    const [breweryRows, productRows, platformRows, sellerRows, offerRows] = await Promise.all([
      supabaseRequest<BreweryRow[]>("traditional_liquor_breweries?select=id,name,region,description&is_active=eq.true&order=name.asc&limit=5000"),
      supabaseRequest<ProductRow[]>("traditional_liquor_products?select=id,brewery_id,name,canonical_name,region,category,sub_category,abv,volume_ml,description&is_active=eq.true&order=name.asc&limit=10000"),
      supabaseRequest<PlatformRow[]>("traditional_liquor_platforms?select=id,name,code&is_active=eq.true&order=name.asc&limit=1000"),
      supabaseRequest<SellerRow[]>("traditional_liquor_sellers?select=id,name&is_active=eq.true&order=name.asc&limit=10000"),
      supabaseRequest<OfferRow[]>("traditional_liquor_offers?select=id,product_id,platform_id,seller_id,listing_title,listing_url,price,original_price,listing_volume_ml,quantity,shipping_fee,last_checked_at&is_active=eq.true&order=last_checked_at.desc.nullslast&limit=20000")
    ]);
    const needle = query.trim().toLocaleLowerCase("ko-KR");
    const breweries = breweryRows.map((row) => ({ id: row.id, name: row.name, region: row.region ?? "", description: row.description ?? "" }));
    const products = productRows.map((row) => ({ id: row.id, name: row.name, canonicalName: row.canonical_name ?? row.name, breweryId: row.brewery_id ?? "", region: row.region ?? "", category: row.category ?? "", subCategory: row.sub_category ?? "", abv: Number(row.abv ?? 0), volumeMl: Number(row.volume_ml ?? 0), description: row.description ?? "" }));
    const platforms = platformRows.map((row) => ({ id: row.id, name: row.name, code: row.code }));
    const sellers = sellerRows.map((row) => ({ id: row.id, name: row.name }));
    const offers = offerRows.map((row) => ({ id: row.id, productId: row.product_id, platformId: row.platform_id, sellerId: row.seller_id, listingTitle: row.listing_title ?? "", price: Number(row.price), originalPrice: row.original_price === null ? null : Number(row.original_price), volumeMl: Number(row.listing_volume_ml ?? 0), quantity: Number(row.quantity), shippingFee: Number(row.shipping_fee ?? 0), url: row.listing_url, lastCheckedAt: row.last_checked_at ?? "" }));
    if (!needle) return { breweries, products, platforms, sellers, offers, source: "postgresql" as const };
    const productIds = new Set(products.filter((item) => [item.name, item.canonicalName, item.region, item.category, item.subCategory].join(" ").toLocaleLowerCase("ko-KR").includes(needle)).map((item) => item.id));
    offers.filter((item) => item.listingTitle.toLocaleLowerCase("ko-KR").includes(needle)).forEach((item) => productIds.add(item.productId));
    const filteredOffers = offers.filter((item) => productIds.has(item.productId) || platforms.find((platform) => platform.id === item.platformId)?.name.toLocaleLowerCase("ko-KR").includes(needle) || sellers.find((seller) => seller.id === item.sellerId)?.name.toLocaleLowerCase("ko-KR").includes(needle));
    filteredOffers.forEach((item) => productIds.add(item.productId));
    return { breweries: breweries.filter((item) => [item.name, item.region, item.description].join(" ").toLocaleLowerCase("ko-KR").includes(needle) || products.some((product) => product.breweryId === item.id && productIds.has(product.id))), products: products.filter((item) => productIds.has(item.id)), platforms, sellers, offers: filteredOffers, source: "postgresql" as const };
  }

  async searchProducts(query: string) { return (await this.getDataset(query)).products; }
  async searchPlatforms(query: string) { return (await this.getDataset(query)).platforms; }
  async searchSellers(query: string) { return (await this.getDataset(query)).sellers; }

  async searchBreweries(query: string) {
    const pattern = queryPattern(query);
    const rows = await supabaseRequest<BreweryRow[]>(`traditional_liquor_breweries?select=id,name,region,description&is_active=eq.true&or=(name.ilike.${pattern},normalized_name.ilike.${pattern},region.ilike.${pattern})&order=name.asc&limit=100`);
    return rows.map((row) => ({ id: row.id, name: row.name, region: row.region ?? "", description: row.description ?? "" }));
  }

  async getProductDetail(productId: string) { return (await this.datasetByFilter(`product_id=eq.${encoded(productId)}`)).products[0] ?? null; }
  async getProductOffers(productId: string) { return (await this.datasetByFilter(`product_id=eq.${encoded(productId)}`)).offers; }
  async getPlatformMarket(platformId: string) { return this.datasetByFilter(`platform_id=eq.${encoded(platformId)}`); }
  async getSellerMarket(sellerId: string) { return this.datasetByFilter(`seller_id=eq.${encoded(sellerId)}`); }

  async getPriceHistory(offerId: string): Promise<PriceHistory[]> {
    const rows = await supabaseRequest<PriceHistoryRow[]>(`traditional_liquor_price_history?select=id,offer_id,observed_at,price,original_price,shipping_fee,stock_status,review_count,rating&offer_id=eq.${encoded(offerId)}&order=observed_at.asc&limit=500`);
    return rows.map((row) => ({ id: row.id, offerId: row.offer_id, observedAt: row.observed_at, price: row.price === null ? null : Number(row.price), originalPrice: row.original_price === null ? null : Number(row.original_price), shippingFee: row.shipping_fee === null ? null : Number(row.shipping_fee), stockStatus: row.stock_status, reviewCount: row.review_count, rating: row.rating === null ? null : Number(row.rating) }));
  }

  private async datasetByFilter(filter: string) {
    const rows = await supabaseRequest<MarketRow[]>(`v_traditional_liquor_market?select=*&${filter}&order=price.asc&limit=500`);
    return marketRowsToDataset(rows);
  }
}
