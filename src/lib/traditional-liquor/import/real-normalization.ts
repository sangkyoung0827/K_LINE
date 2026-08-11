import { normalizeSearchText, parsePrice } from "@/lib/traditional-liquor/collection/normalization";
import type { MappedImportRecord } from "@/lib/traditional-liquor/import/real-import-types";

function text(value: unknown) { return value === null || value === undefined ? null : String(value).trim() || null; }
function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : parsePrice(text(value)); }
function url(value: unknown) { return text(value); }
function dateTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date((value - 25569) * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return text(value);
}
const productStatuses = new Set(["OFFICIAL", "LIKELY", "UNKNOWN", "NON_TRADITIONAL"]);

export function normalizeRealImportRecord(record: MappedImportRecord) {
  const data = record.mappedData;
  if (record.importType === "PRODUCT_MASTER") {
    const productName = text(data.product_name);
    const breweryName = text(data.brewery_name);
    return {
      importType: record.importType, productName, normalizedProductName: normalizeSearchText(productName), canonicalName: text(data.canonical_name) ?? productName,
      breweryName, normalizedBreweryName: normalizeSearchText(breweryName), region: text(data.region), province: text(data.province), city: text(data.city), category: text(data.category), subCategory: text(data.sub_category),
      abv: number(data.abv), volumeMl: number(data.volume_ml), ingredients: text(data.ingredients), description: text(data.description), officialProductUrl: url(data.official_product_url), breweryUrl: url(data.brewery_url),
      traditionalLiquorStatus: text(data.traditional_liquor_status)?.toUpperCase() ?? "UNKNOWN", sourceName: record.sourceName, sourceUrl: url(data.source_url)
    };
  }
  const listingTitle = text(data.listing_title);
  const productName = text(data.product_name) ?? listingTitle;
  const volumeMl = number(data.volume_ml);
  const quantity = number(data.quantity) ?? 1;
  return {
    importType: record.importType, listingTitle, normalizedListingTitle: normalizeSearchText(listingTitle), productName, normalizedProductName: normalizeSearchText(productName), platformCode: text(data.platform_code)?.toUpperCase(),
    sellerName: text(data.seller_name), normalizedSellerName: normalizeSearchText(text(data.seller_name)), price: number(data.price), originalPrice: number(data.original_price), shippingFee: number(data.shipping_fee),
    listingVolumeMl: volumeMl, quantity, totalVolumeMl: number(data.total_volume_ml) ?? (volumeMl && quantity ? volumeMl * quantity : null), stockStatus: text(data.stock_status), reviewCount: number(data.review_count), rating: number(data.rating),
    externalOfferId: text(data.external_offer_id), listingUrl: url(data.listing_url), query: text(data.query), collectedAt: dateTime(data.collected_at) ?? new Date().toISOString(), sourceName: record.sourceName
  };
}

export interface RealValidationIssue { code: string; field: string; message: string; rawValue?: string | null; severity: "ERROR" | "WARNING"; }

export function validateRealImportRecord(normalized: ReturnType<typeof normalizeRealImportRecord>) {
  const issues: RealValidationIssue[] = [];
  const add = (code: string, field: string, message: string, severity: "ERROR" | "WARNING" = "ERROR") => issues.push({ code, field, message, rawValue: String((normalized as Record<string, unknown>)[field] ?? ""), severity });
  if (normalized.importType === "PRODUCT_MASTER") {
    if (!normalized.productName) add("MISSING_PRODUCT_NAME", "productName", "제품명이 필요합니다.");
    if (!normalized.breweryName) add("MISSING_BREWERY_NAME", "breweryName", "양조장 이름이 없습니다.", "WARNING");
    if (normalized.abv !== null && (normalized.abv < 0 || normalized.abv > 100)) add("INVALID_ABV", "abv", "도수는 0~100이어야 합니다.");
    if (normalized.volumeMl !== null && normalized.volumeMl <= 0) add("INVALID_VOLUME", "volumeMl", "용량은 0보다 커야 합니다.");
    if (!productStatuses.has(normalized.traditionalLiquorStatus)) add("INVALID_TRADITIONAL_LIQUOR_STATUS", "traditionalLiquorStatus", "전통주 상태 값이 올바르지 않습니다.");
    for (const field of ["officialProductUrl", "breweryUrl", "sourceUrl"] as const) {
      if (normalized[field]) { try { new URL(normalized[field]); } catch { add("INVALID_URL", field, `${field} URL 형식이 올바르지 않습니다.`); } }
    }
  } else {
    if (!normalized.listingTitle && !normalized.productName) add("MISSING_LISTING_TITLE", "listingTitle", "listing_title 또는 product_name이 필요합니다.");
    if (!normalized.platformCode) add("UNKNOWN_PLATFORM", "platformCode", "플랫폼 코드가 필요합니다.");
    if (!normalized.sellerName) add("MISSING_SELLER_NAME", "sellerName", "판매업체가 필요합니다.");
    if (normalized.price === null || normalized.price < 0) add("INVALID_PRICE", "price", "유효한 가격이 필요합니다.");
    if (normalized.originalPrice !== null && normalized.originalPrice < 0) add("INVALID_ORIGINAL_PRICE", "originalPrice", "정상가는 0 이상이어야 합니다.");
    if (normalized.shippingFee !== null && normalized.shippingFee < 0) add("INVALID_SHIPPING_FEE", "shippingFee", "배송비는 0 이상이어야 합니다.");
    if (normalized.quantity === null || normalized.quantity <= 0 || !Number.isInteger(normalized.quantity)) add("INVALID_QUANTITY", "quantity", "수량은 1 이상의 정수여야 합니다.");
    if (normalized.reviewCount !== null && (normalized.reviewCount < 0 || !Number.isInteger(normalized.reviewCount))) add("INVALID_REVIEW_COUNT", "reviewCount", "리뷰 수는 0 이상의 정수여야 합니다.");
    if (normalized.rating !== null && (normalized.rating < 0 || normalized.rating > 5)) add("INVALID_RATING", "rating", "평점은 0~5여야 합니다.");
    if (normalized.listingVolumeMl !== null && normalized.listingVolumeMl <= 0) add("INVALID_VOLUME", "listingVolumeMl", "용량은 0보다 커야 합니다.");
    if (normalized.collectedAt && Number.isNaN(Date.parse(normalized.collectedAt))) add("INVALID_COLLECTED_AT", "collectedAt", "수집 시각 형식이 올바르지 않습니다.");
    if (!normalized.externalOfferId && !normalized.listingUrl) add("MISSING_OFFER_IDENTITY", "listingUrl", "external_offer_id 또는 listing_url이 필요합니다.");
    if (normalized.listingUrl) { try { new URL(normalized.listingUrl); } catch { add("INVALID_URL", "listingUrl", "판매 URL 형식이 올바르지 않습니다."); } }
  }
  return { status: issues.some((issue) => issue.severity === "ERROR") ? "INVALID" as const : "VALID" as const, issues };
}
