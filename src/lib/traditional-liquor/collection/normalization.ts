import type { NormalizedOffer, RawCollectedOffer } from "@/lib/traditional-liquor/collection/types";

function numericText(value?: string | null) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function normalizeSearchText(value?: string | null) {
  if (!value) return null;
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\[\]{}()<>]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parsePrice(value?: string | null) {
  return numericText(value);
}

export function parseShippingFee(value?: string | null) {
  if (!value) return null;
  if (/무료|free/i.test(value)) return 0;
  return numericText(value);
}

export function parseVolumeAndQuantity(volumeText?: string | null, quantityText?: string | null) {
  const listingVolumeMl = volumeText ? numericText(volumeText.match(/\d[\d,.]*\s*(?:ml|㎖)/i)?.[0] ?? null) : null;
  const quantityFromVolume = volumeText ? numericText(volumeText.match(/[x×*]\s*\d+/i)?.[0] ?? null) : null;
  const quantity = numericText(quantityText) ?? quantityFromVolume ?? (listingVolumeMl ? 1 : null);
  return {
    listingVolumeMl,
    quantity,
    totalVolumeMl: listingVolumeMl && quantity ? listingVolumeMl * quantity : null
  };
}

export function normalizeOffer(raw: RawCollectedOffer): NormalizedOffer {
  const volume = parseVolumeAndQuantity(raw.volumeText, raw.quantityText);
  return {
    sourceName: raw.sourceName,
    platformCode: raw.platformCode,
    query: raw.query,
    externalOfferId: raw.externalOfferId,
    listingTitle: raw.listingTitle.trim(),
    normalizedListingTitle: normalizeSearchText(raw.listingTitle) ?? "",
    sellerName: raw.sellerName?.trim() || null,
    normalizedSellerName: normalizeSearchText(raw.sellerName),
    price: parsePrice(raw.priceText),
    originalPrice: parsePrice(raw.originalPriceText),
    shippingFee: parseShippingFee(raw.shippingText),
    ...volume,
    abv: numericText(raw.abvText),
    stockStatus: raw.stockText?.trim() || null,
    reviewCount: numericText(raw.reviewCountText),
    rating: numericText(raw.ratingText),
    listingUrl: raw.listingUrl?.trim() || null,
    collectedAt: raw.collectedAt
  };
}
