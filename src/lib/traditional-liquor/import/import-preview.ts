import type { ColumnMapping, RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

type UnknownRecord = Record<string, unknown>;

export interface ImportPreview {
  title: unknown;
  seller: unknown;
  price: unknown;
  platform: unknown;
  volumeMl: unknown;
  quantity: unknown;
  listingUrl: unknown;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function first(...values: unknown[]) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== "") ?? null;
}

function mappedSample(raw: UnknownRecord, mapping: ColumnMapping) {
  return Object.fromEntries(Object.entries(mapping).flatMap(([source, target]) => target && Object.prototype.hasOwnProperty.call(raw, source) ? [[target, raw[source]]] : []));
}

export function createImportPreview(importType: RealImportType, normalizedValue: unknown, rawValue: unknown, mapping: ColumnMapping = {}): ImportPreview {
  const normalized = record(normalizedValue);
  const envelope = record(rawValue);
  const raw = record(envelope.rawData ?? rawValue);
  const mapped = { ...mappedSample(raw, mapping), ...record(envelope.mappedData) };

  if (importType === "PRODUCT_MASTER") {
    return {
      title: first(normalized.productName, normalized.product_name, mapped.product_name, raw.product_name),
      seller: first(normalized.breweryName, normalized.brewery_name, mapped.brewery_name, raw.brewery_name),
      price: null, platform: null, volumeMl: first(normalized.volumeMl, normalized.volume_ml, mapped.volume_ml, raw.volume_ml),
      quantity: null, listingUrl: first(normalized.officialProductUrl, normalized.official_product_url, mapped.official_product_url, raw.official_product_url)
    };
  }

  return {
    title: first(normalized.listingTitle, normalized.listing_title, normalized.productName, normalized.product_name, mapped.listing_title, mapped.product_name, raw.listing_title, raw.product_name),
    seller: first(normalized.sellerName, normalized.seller_name, mapped.seller_name, raw.seller_name),
    price: first(normalized.price, mapped.price, raw.price),
    platform: first(normalized.platformCode, normalized.platform_code, mapped.platform_code, raw.platform_code),
    volumeMl: first(normalized.listingVolumeMl, normalized.volumeMl, normalized.volume_ml, mapped.volume_ml, raw.volume_ml),
    quantity: first(normalized.quantity, mapped.quantity, raw.quantity),
    listingUrl: first(normalized.listingUrl, normalized.listing_url, mapped.listing_url, raw.listing_url)
  };
}

export function formatPreviewPrice(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? `${numeric.toLocaleString("ko-KR")}원` : String(value);
}
