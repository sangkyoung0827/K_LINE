import type { NormalizedOffer, RawCollectedOffer, ValidatedOffer, ValidationIssue } from "@/lib/traditional-liquor/collection/types";

function issue(code: ValidationIssue["code"], field: string, message: string, rawValue: string | null | undefined, severity: ValidationIssue["severity"]): ValidationIssue {
  return { code, field, message, rawValue, severity };
}

export function validateRawOffer(raw: RawCollectedOffer, normalized: NormalizedOffer): ValidatedOffer {
  const issues: ValidationIssue[] = [];
  if (!raw.listingTitle.trim()) issues.push(issue("MISSING_LISTING_TITLE", "listingTitle", "상품명이 필요합니다.", raw.listingTitle, "ERROR"));
  if (raw.priceText && normalized.price === null) issues.push(issue("INVALID_PRICE", "priceText", "가격 형식을 해석할 수 없습니다.", raw.priceText, "ERROR"));
  if (!raw.priceText) issues.push(issue("INVALID_PRICE", "priceText", "가격 정보가 없습니다.", raw.priceText, "WARNING"));
  if (raw.listingUrl) {
    try { new URL(raw.listingUrl); } catch { issues.push(issue("INVALID_URL", "listingUrl", "URL 형식이 올바르지 않습니다.", raw.listingUrl, "ERROR")); }
  } else {
    issues.push(issue("INVALID_URL", "listingUrl", "원본 URL이 없습니다.", raw.listingUrl, "WARNING"));
  }
  if (!raw.platformCode) issues.push(issue("UNKNOWN_PLATFORM", "platformCode", "플랫폼 코드가 없습니다.", raw.platformCode, "WARNING"));
  return { raw, normalized, status: issues.some((item) => item.severity === "ERROR") ? "INVALID" : "VALID", issues };
}
