import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectorResultToParsedImport, summarizeCollectorResult, validateCollectorResult } from "@/lib/traditional-liquor/collector/import-adapter";
import { buildCollectorTargetUrl, collectorPlatforms, getCollectorPlatform } from "@/lib/traditional-liquor/collector/platform-registry";
import type { CollectorResultPayload } from "@/lib/traditional-liquor/collector/types";
import { resolveImportRow } from "@/lib/traditional-liquor/import/entity-resolution";

function fixture(platformCode: "NAVER" | "KAKAO_GIFT" = "NAVER"): CollectorResultPayload {
  const sourceUrl = platformCode === "NAVER" ? "https://search.shopping.naver.com/search/all?query=%EC%A0%84%ED%86%B5%EC%A3%BC" : "https://gift.kakao.com/search/result?query=%EC%A0%84%ED%86%B5%EC%A3%BC";
  const metricType = platformCode === "NAVER" ? "SOURCE_PURCHASE_COUNT" : "WISH_COUNT";
  return {
    version: "1", platformCode, query: "전통주", collectedAt: "2026-08-12T00:00:00.000Z",
    items: [{
      identity: { externalOfferId: "offer-1", sourceEntityId: "offer-1", metricScope: "OFFER" },
      product: { productName: "테스트 전통주 750ml", sellerName: "공개 판매처", listingUrl: sourceUrl },
      offer: { price: 12_000, volumeMl: 750, quantity: 1 },
      metrics: [{ type: metricType, value: 123, scope: "OFFER" }, { type: "SEARCH_RANK", value: 1, scope: "OFFER" }],
      provenance: { platformCode, query: "전통주", sourceUrl, collectedAt: "2026-08-12T00:00:00.000Z", collectorVersion: `${platformCode}_V1` }
    }],
    diagnostics: { collectorVersion: `${platformCode}_V1`, platform: platformCode, pageUrl: sourceUrl, query: "전통주", scannedCount: 1, collectedItems: 1, skippedItems: 0, offersCount: 1, metricsCount: 2, warnings: [], errors: [] }
  };
}

test("registry drives NAVER and KAKAO_GIFT metrics and target URLs", () => {
  assert.deepEqual(collectorPlatforms.map((platform) => platform.code), ["NAVER", "KAKAO_GIFT"]);
  assert.equal(getCollectorPlatform("KAKAO_GIFT")?.metrics.find((metric) => metric.type === "SOURCE_PURCHASE_COUNT")?.availability, "UNAVAILABLE");
  assert.match(buildCollectorTargetUrl(getCollectorPlatform("NAVER")!, "전통주 선물"), /^https:\/\/search\.shopping\.naver\.com\//);
});

test("validated collector payload becomes the existing MARKET_OFFER import", () => {
  const converted = collectorResultToParsedImport(validateCollectorResult(fixture()));
  assert.equal(converted.parsed.importType, "MARKET_OFFER");
  assert.equal(converted.parsed.records.length, 1);
  assert.equal(converted.parsed.records[0].rawData.source_purchase_count, 123);
  assert.equal(converted.parsed.records[0].rawData.platform_code, "NAVER");
  assert.equal(converted.mapping.external_offer_id, "external_offer_id");
});

test("KAKAO_GIFT does not synthesize purchase counts", () => {
  const converted = collectorResultToParsedImport(validateCollectorResult(fixture("KAKAO_GIFT")));
  assert.equal(converted.parsed.records[0].rawData.wish_count, 123);
  assert.equal(converted.parsed.records[0].rawData.source_purchase_count, null);
});

test("collector rejects unsupported provenance, metrics, and oversized input", () => {
  const invalidHost = fixture(); invalidHost.items[0].provenance.sourceUrl = "https://example.com/market";
  assert.throws(() => validateCollectorResult(invalidHost), /INVALID_COLLECTOR_URL/);
  const invalidMetric = fixture("KAKAO_GIFT"); invalidMetric.items[0].metrics.push({ type: "SOURCE_PURCHASE_COUNT", value: 0, scope: "OFFER" });
  assert.throws(() => validateCollectorResult(invalidMetric), /INVALID_COLLECTOR_METRIC/);
  const oversized = fixture(); oversized.items = Array.from({ length: 1001 }, () => oversized.items[0]);
  assert.throws(() => validateCollectorResult(oversized), /COLLECTOR_ITEM_LIMIT_EXCEEDED/);
});

test("diagnostics summary exposes omissions instead of hiding them", () => {
  const payload = fixture(); payload.diagnostics.skippedItems = 2;
  assert.deepEqual(summarizeCollectorResult(payload, 1, 1), { products: 1, offers: 1, metrics: { SOURCE_PURCHASE_COUNT: 1, SEARCH_RANK: 1 }, skipped: 3 });
});

test("summary counts product names separately from seller offer identities", () => {
  const payload = fixture();
  payload.items.push({ ...payload.items[0], identity: { ...payload.items[0].identity, sourceEntityId: "offer-2", externalOfferId: "offer-2" } });
  assert.equal(summarizeCollectorResult(payload, 2, 0).products, 1);
  assert.equal(summarizeCollectorResult(payload, 2, 0).offers, 2);
});

test("entity resolution reuses an exact platform and external offer identity before fuzzy names", () => {
  const result = resolveImportRow(
    { importType: "MARKET_OFFER", platformCode: "NAVER", externalOfferId: "offer-1", productName: "변경된 표시명", sellerName: "변경된 판매처" },
    {
      products: [], breweries: [], sellers: [], productAliases: [], sellerAliases: [], platformAliases: [],
      platforms: [{ id: "platform-1", code: "NAVER", name: "네이버" }],
      offers: [{ id: "stored-offer", product_id: "product-1", platform_id: "platform-1", seller_id: "seller-1", external_offer_id: "offer-1", listing_url: null }]
    }
  );
  assert.equal(result.status, "MATCHED");
  assert.equal(result.productId, "product-1");
  assert.equal(result.sellerId, "seller-1");
});

test("job APIs remain developer-created and token-uploaded with no client secrets", () => {
  const createRoute = readFileSync("src/app/api/v4/traditional-liquor/collector/jobs/route.ts", "utf8");
  const resultRoute = readFileSync("src/app/api/v4/traditional-liquor/collector/jobs/[jobId]/result/route.ts", "utf8");
  const worker = readFileSync("extensions/woo-hyukmon-market-collector/src/background/service-worker.ts", "utf8");
  assert.match(createRoute, /requireWoohyukmonV4DeveloperApi/);
  assert.match(resultRoute, /collectorTokenMatches/);
  assert.match(resultRoute, /stageFile/);
  assert.doesNotMatch(worker, /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|DB_PASSWORD/);
});

test("migration is RLS-protected and stores only token hashes", () => {
  const sql = readFileSync("supabase/traditional_liquor_market_collector_v1.sql", "utf8");
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all .* anon, authenticated/i);
  assert.doesNotMatch(sql, /collector_token text/);
});
