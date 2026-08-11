import { fieldsForImportType, type ColumnMapping, type MappedImportRecord, type RawImportRecord, type RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

const aliases: Record<string, string[]> = {
  product_name: ["productname", "product", "제품명", "상품명", "전통주명"],
  canonical_name: ["canonicalname", "표준명", "정식명"],
  brewery_name: ["breweryname", "brewery", "양조장", "제조사", "생산자"],
  region: ["region", "지역", "소재지"], province: ["province", "시도", "도"], city: ["city", "시군구", "도시"],
  category: ["category", "대분류", "주종"], sub_category: ["subcategory", "소분류", "세부주종"],
  abv: ["abv", "alcohol", "alcoholpercentage", "도수", "알코올도수"], volume_ml: ["volumeml", "volume", "용량", "용량ml"],
  ingredients: ["ingredients", "원재료", "재료"], description: ["description", "설명", "소개"],
  official_product_url: ["officialproducturl", "producturl", "제품url", "공식제품url"], brewery_url: ["breweryurl", "양조장url", "제조사url"],
  traditional_liquor_status: ["traditionalliquorstatus", "전통주상태", "전통주여부"], source_name: ["sourcename", "출처명", "자료명"], source_url: ["sourceurl", "출처url", "자료url"],
  listing_title: ["listingtitle", "listing", "판매상품명", "등록상품명", "상품제목"], platform_code: ["platformcode", "platform", "플랫폼", "판매플랫폼"],
  seller_name: ["sellername", "seller", "판매처", "판매자", "업체명"], price: ["price", "판매가", "가격"], original_price: ["originalprice", "정가", "원가"],
  shipping_fee: ["shippingfee", "배송비"], quantity: ["quantity", "수량", "개수"], total_volume_ml: ["totalvolumeml", "총용량", "총용량ml"],
  stock_status: ["stockstatus", "재고", "재고상태"], review_count: ["reviewcount", "리뷰수", "후기수"], rating: ["rating", "평점"],
  external_offer_id: ["externalofferid", "offerid", "외부상품id"], listing_url: ["listingurl", "url", "판매url", "상품url"], query: ["query", "검색어"], collected_at: ["collectedat", "수집일", "수집시각", "기준일"]
};

export function normalizeColumnName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function suggestColumnMapping(headers: string[], importType: RealImportType): ColumnMapping {
  const fields = fieldsForImportType(importType);
  const result: ColumnMapping = {};
  headers.forEach((header) => {
    const normalized = normalizeColumnName(header);
    const field = fields.find((candidate) => candidate === header || normalizeColumnName(candidate) === normalized || aliases[candidate]?.includes(normalized));
    if (field) result[header] = field;
  });
  return result;
}

export function applyColumnMapping(record: RawImportRecord, mapping: ColumnMapping, fallbackSourceName: string): MappedImportRecord {
  const mappedData: Record<string, unknown> = {};
  Object.entries(mapping).forEach(([sourceColumn, targetField]) => {
    if (targetField && Object.prototype.hasOwnProperty.call(record.rawData, sourceColumn)) mappedData[targetField] = record.rawData[sourceColumn];
  });
  return { ...record, sourceName: String(mappedData.source_name || record.sourceName || fallbackSourceName).trim(), mappedData };
}
