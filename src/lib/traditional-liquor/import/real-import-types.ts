export type RealImportType = "PRODUCT_MASTER" | "MARKET_OFFER";
export type ImportFileType = "CSV" | "XLSX" | "JSON";

export interface RawImportRecord {
  importType: RealImportType;
  rowNumber: number;
  sourceName?: string;
  rawData: Record<string, unknown>;
}

export interface ParsedImportFile {
  fileType: ImportFileType;
  fileName: string;
  headers: string[];
  records: RawImportRecord[];
}

export type ColumnMapping = Record<string, string>;

export interface MappedImportRecord {
  importType: RealImportType;
  rowNumber: number;
  sourceName: string;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
}

export interface RealImportAnalysis {
  fileType: ImportFileType;
  fileName: string;
  importType: RealImportType;
  headers: string[];
  suggestedMapping: ColumnMapping;
  sampleRows: Array<Record<string, unknown>>;
  totalRows: number;
}

export const productMasterFields = [
  "product_name", "canonical_name", "brewery_name", "region", "province", "city", "category", "sub_category", "abv", "volume_ml", "ingredients", "description", "official_product_url", "brewery_url", "traditional_liquor_status", "source_name", "source_url"
] as const;

export const marketOfferFields = [
  "listing_title", "product_name", "platform_code", "seller_name", "price", "original_price", "shipping_fee", "volume_ml", "quantity", "total_volume_ml", "stock_status", "review_count", "rating", "external_offer_id", "listing_url", "query", "collected_at", "source_name"
] as const;

export function fieldsForImportType(importType: RealImportType) {
  return importType === "PRODUCT_MASTER" ? [...productMasterFields] : [...marketOfferFields];
}
