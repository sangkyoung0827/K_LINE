import { suggestColumnMapping } from "@/lib/traditional-liquor/import/column-mapping";
import type { RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

export interface ImportTypeDetection {
  importType: RealImportType | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score: number;
  reasons: string[];
}

const marketCore = ["listing_title", "platform_code", "seller_name", "price"];
const productCore = ["product_name", "brewery_name", "category", "abv", "volume_ml"];

function sheetType(sheetName?: string): RealImportType | null {
  const normalized = sheetName?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "MARKET_OFFER") return "MARKET_OFFER";
  if (normalized === "PRODUCT_MASTER") return "PRODUCT_MASTER";
  return null;
}

export function detectImportType(headers: string[], sheetName?: string): ImportTypeDetection {
  const marketFields = new Set(Object.values(suggestColumnMapping(headers, "MARKET_OFFER")));
  const productFields = new Set(Object.values(suggestColumnMapping(headers, "PRODUCT_MASTER")));
  const marketMatches = marketCore.filter((field) => marketFields.has(field));
  const productMatches = productCore.filter((field) => productFields.has(field));
  const namedType = sheetType(sheetName);
  let marketScore = marketMatches.length * 18;
  let productScore = productMatches.length * 14;

  if (marketMatches.length === marketCore.length) marketScore += 45;
  if (productFields.has("product_name") && productMatches.length >= 3) productScore += 35;
  if (namedType === "MARKET_OFFER") marketScore += 50;
  if (namedType === "PRODUCT_MASTER") productScore += 50;

  // product_name is shared by both formats and is never enough to classify a file.
  const marketEligible = marketMatches.length === marketCore.length || namedType === "MARKET_OFFER";
  const productEligible = (productFields.has("product_name") && productMatches.length >= 3) || namedType === "PRODUCT_MASTER";
  const importType = marketEligible && (!productEligible || marketScore >= productScore)
    ? "MARKET_OFFER"
    : productEligible ? "PRODUCT_MASTER" : null;
  const score = importType === "MARKET_OFFER" ? marketScore : importType === "PRODUCT_MASTER" ? productScore : Math.max(marketScore, productScore);
  const reasons = [
    ...(namedType ? [`시트명 ${sheetName} → ${namedType}`] : []),
    ...(marketMatches.length ? [`MARKET_OFFER 헤더 ${marketMatches.join(", ")}`] : []),
    ...(productMatches.length ? [`PRODUCT_MASTER 헤더 ${productMatches.join(", ")}`] : [])
  ];

  return {
    importType,
    confidence: importType && score >= 100 ? "HIGH" : importType && score >= 60 ? "MEDIUM" : "LOW",
    score,
    reasons
  };
}
