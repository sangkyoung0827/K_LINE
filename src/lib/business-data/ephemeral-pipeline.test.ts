import assert from "node:assert/strict";
import test from "node:test";
import {
  detectBusinessCollectionRequest,
  runEphemeralBusinessDataPipeline
} from "@/lib/business-data/ephemeral-pipeline";

test("detects explicit Korean and English collection commands", () => {
  assert.equal(
    detectBusinessCollectionRequest("외국인이 한국에서 가장 많이 사는 기념품에 대한 데이터를 수집해")?.query,
    "외국인이 한국에서 가장 많이 사는 기념품에 대한"
  );
  assert.ok(detectBusinessCollectionRequest("Collect market data about Korean souvenirs"));
  assert.equal(detectBusinessCollectionRequest("한국 기념품을 추천해줘"), null);
});

test("runs the transient pipeline without database identifiers", () => {
  const result = runEphemeralBusinessDataPipeline(
    { query: "한국 기념품" },
    [
      { provider: "Brave", title: "Souvenir guide", snippet: "Popular gifts cost 15,000원.", url: "https://example.com/a" },
      { provider: "Brave", title: "Duplicate", snippet: "Duplicate row", url: "https://example.com/a" },
      { provider: "Wikipedia", title: "한국 기념품", snippet: "문화 상품 안내", url: "https://ko.wikipedia.org/wiki/example" },
      { provider: "Broken", title: "Bad", snippet: "Bad URL", url: "javascript:alert(1)" }
    ],
    "2026-08-23T00:00:00.000Z"
  );

  assert.equal(result.summary.stagedRows, 4);
  assert.equal(result.summary.approvedRows, 2);
  assert.equal(result.summary.discardedRows, 2);
  assert.equal(result.summary.entityCount, 2);
  assert.match(result.context, /transient Production snapshot/);
  assert.match(result.context, /15,000원/);
  assert.doesNotMatch(result.context, /traditional_liquor_import_staging_rows/);
});
