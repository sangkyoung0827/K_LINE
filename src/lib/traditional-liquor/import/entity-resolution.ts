import { normalizeSearchText } from "@/lib/traditional-liquor/collection/normalization";

export type ResolutionStatus = "UNRESOLVED" | "MATCHED" | "NEW_ENTITY" | "MANUAL_REVIEW";
export type ProductEntity = { id: string; brewery_id: string | null; name: string; canonical_name: string | null; normalized_name: string | null; abv: number | null; volume_ml: number | null };
export type BreweryEntity = { id: string; name: string; normalized_name: string | null; region: string | null; province: string | null; city: string | null };
export type SellerEntity = { id: string; name: string; normalized_name: string | null };
export type PlatformEntity = { id: string; code: string; name: string };
export type OfferEntity = { id: string; product_id: string; platform_id: string; seller_id: string; external_offer_id: string | null; listing_url: string | null };
export type AliasEntity = { product_id?: string; seller_id?: string; normalized_alias: string | null };
export type PlatformAliasEntity = { platform_id: string; alias_name: string; normalized_alias: string | null };

export interface ResolutionEntities {
  products: ProductEntity[];
  breweries: BreweryEntity[];
  sellers: SellerEntity[];
  platforms: PlatformEntity[];
  offers?: OfferEntity[];
  platformAliases: PlatformAliasEntity[];
  productAliases: AliasEntity[];
  sellerAliases: AliasEntity[];
}

export interface ImportRowResolution {
  status: ResolutionStatus;
  productId: string | null;
  sellerId: string | null;
  platformId: string | null;
  breweryId: string | null;
  details: {
    reasons: string[];
    candidates: Record<string, Array<{ id: string; name: string }>>;
    platform: { id: string; code: string; name: string; match: "CODE_EXACT" | "ALIAS_EXACT" | null } | null;
  };
}

function comparable(value: unknown) {
  return normalizeSearchText(value === null || value === undefined ? null : String(value)) ?? "";
}

function tokenSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const a = new Set(left.split(" ").filter(Boolean));
  const b = new Set(right.split(" ").filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  const tokenScore = union ? intersection / union : 0;
  const compactLeft = left.replace(/\s+/g, "");
  const compactRight = right.replace(/\s+/g, "");
  const grams = (value: string) => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2)));
  const leftGrams = grams(compactLeft);
  const rightGrams = grams(compactRight);
  const shared = [...leftGrams].filter((gram) => rightGrams.has(gram)).length;
  const diceScore = leftGrams.size + rightGrams.size ? (2 * shared) / (leftGrams.size + rightGrams.size) : Number(compactLeft === compactRight);
  return Math.max(tokenScore, diceScore);
}

function fuzzyCandidates<T extends { id: string; name: string; normalized_name: string | null }>(needle: string, rows: T[]) {
  return rows
    .map((row) => ({ row, score: tokenSimilarity(needle, comparable(row.normalized_name ?? row.name)) }))
    .filter(({ score }) => score >= 0.72)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ row }) => row);
}

function candidates(rows: Array<{ id: string; name: string }>) {
  return rows.slice(0, 8).map(({ id, name }) => ({ id, name }));
}

export function resolveImportRow(data: Record<string, unknown>, entities: ResolutionEntities): ImportRowResolution {
  const importType = String(data.importType);
  const normalizedBrewery = comparable(data.normalizedBreweryName ?? data.breweryName);
  const region = comparable(data.region ?? data.province ?? data.city);
  let breweryMatches = normalizedBrewery
    ? entities.breweries.filter((item) => comparable(item.normalized_name ?? item.name) === normalizedBrewery)
    : [];
  if (region && breweryMatches.length > 1) {
    breweryMatches = breweryMatches.filter((item) => [item.region, item.province, item.city].some((value) => comparable(value) === region));
  }
  const brewerySuggestions = breweryMatches.length ? breweryMatches : fuzzyCandidates(normalizedBrewery, entities.breweries);
  const breweryId = breweryMatches.length === 1 ? breweryMatches[0].id : null;

  const rawPlatformCode = String(data.platformCode ?? "").trim();
  const platformCode = rawPlatformCode.toUpperCase();
  const exactPlatform = entities.platforms.find((item) => item.code.trim().toUpperCase() === platformCode) ?? null;
  const normalizedPlatformAlias = comparable(rawPlatformCode);
  const aliasPlatformIds = !exactPlatform && normalizedPlatformAlias
    ? new Set(entities.platformAliases
        .filter((item) => comparable(item.normalized_alias ?? item.alias_name) === normalizedPlatformAlias)
        .map((item) => item.platform_id))
    : new Set<string>();
  const aliasPlatforms = entities.platforms.filter((item) => aliasPlatformIds.has(item.id));
  const platform = exactPlatform ?? (aliasPlatforms.length === 1 ? aliasPlatforms[0] : null);
  const platformMatch = exactPlatform ? "CODE_EXACT" : platform ? "ALIAS_EXACT" : null;
  const externalOfferId = String(data.externalOfferId ?? "").trim();
  const listingUrl = String(data.listingUrl ?? "").trim();
  const exactOffer = platform
    ? (entities.offers ?? []).find((item) => item.platform_id === platform.id && (
        (externalOfferId && item.external_offer_id === externalOfferId)
        || (!externalOfferId && listingUrl && item.listing_url === listingUrl)
      )) ?? null
    : null;

  const normalizedSeller = comparable(data.normalizedSellerName ?? data.sellerName);
  let sellerMatches = normalizedSeller
    ? entities.sellers.filter((item) => comparable(item.normalized_name ?? item.name) === normalizedSeller)
    : [];
  if (!sellerMatches.length && normalizedSeller) {
    const aliasIds = new Set(entities.sellerAliases.filter((item) => comparable(item.normalized_alias) === normalizedSeller).map((item) => item.seller_id).filter(Boolean));
    sellerMatches = entities.sellers.filter((item) => aliasIds.has(item.id));
  }
  const sellerSuggestions = sellerMatches.length ? sellerMatches : fuzzyCandidates(normalizedSeller, entities.sellers);
  const sellerId = exactOffer?.seller_id ?? (sellerMatches.length === 1 ? sellerMatches[0].id : null);

  const normalizedProduct = comparable(data.normalizedProductName ?? data.productName ?? data.listingTitle);
  let productMatches = normalizedProduct
    ? entities.products.filter((item) => comparable(item.normalized_name ?? item.name) === normalizedProduct || comparable(item.canonical_name) === normalizedProduct)
    : [];
  if (!productMatches.length && normalizedProduct) {
    const aliasIds = new Set(entities.productAliases.filter((item) => comparable(item.normalized_alias) === normalizedProduct).map((item) => item.product_id).filter(Boolean));
    productMatches = entities.products.filter((item) => aliasIds.has(item.id));
  }
  if (normalizedBrewery && breweryId) productMatches = productMatches.filter((item) => item.brewery_id === breweryId);
  const abv = data.abv === null || data.abv === undefined || data.abv === "" ? null : Number(data.abv);
  const volume = Number(data.volumeMl ?? data.listingVolumeMl ?? 0) || null;
  const exactSku = productMatches.filter((item) => (abv === null || Number(item.abv) === abv) && (volume === null || Number(item.volume_ml) === volume));
  const productId = exactOffer?.product_id ?? (exactSku.length === 1 && (!normalizedBrewery || breweryId) ? exactSku[0].id : null);
  const productSuggestions = exactSku.length ? exactSku : productMatches;

  const reasons: string[] = [];
  if (importType === "MARKET_OFFER" && !platform) reasons.push("UNKNOWN_PLATFORM");
  if (breweryMatches.length > 1) reasons.push("AMBIGUOUS_BREWERY");
  if (!exactOffer && sellerMatches.length > 1) reasons.push("AMBIGUOUS_SELLER");
  if (!exactOffer && (exactSku.length > 1 || (productMatches.length > 0 && exactSku.length === 0))) reasons.push("AMBIGUOUS_PRODUCT");
  if (!exactOffer && !productMatches.length && fuzzyCandidates(normalizedProduct, entities.products).length) reasons.push("SIMILAR_PRODUCT_CANDIDATE");
  if (!exactOffer && !sellerMatches.length && sellerSuggestions.length) reasons.push("SIMILAR_SELLER_CANDIDATE");
  if (!breweryMatches.length && brewerySuggestions.length) reasons.push("SIMILAR_BREWERY_CANDIDATE");

  const requiresReview = reasons.length > 0;
  const allRequiredMatched = productId && (importType === "PRODUCT_MASTER" || sellerId);
  const status: ResolutionStatus = requiresReview ? "MANUAL_REVIEW" : allRequiredMatched ? "MATCHED" : "NEW_ENTITY";
  const fuzzyProducts = !productSuggestions.length ? fuzzyCandidates(normalizedProduct, entities.products) : [];

  return {
    status,
    productId,
    sellerId,
    platformId: platform?.id ?? null,
    breweryId,
    details: {
      reasons,
      candidates: {
        products: candidates(productSuggestions.length ? productSuggestions : fuzzyProducts),
        breweries: candidates(brewerySuggestions),
        sellers: candidates(sellerSuggestions),
        platforms: platform ? candidates([platform]) : candidates(entities.platforms).slice(0, 50)
      },
      platform: platform ? { id: platform.id, code: platform.code, name: platform.name, match: platformMatch } : null
    }
  };
}
