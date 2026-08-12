import assert from "node:assert/strict";
import test from "node:test";
import {
  detectTraditionalLiquorAnalytics,
  detectTraditionalLiquorIntent,
  parseTraditionalLiquorAnalytics,
  serializeTraditionalLiquorAnalytics
} from "@/lib/traditional-liquor/intents";

test("preserves the two existing exact direct commands", () => {
  assert.equal(detectTraditionalLiquorIntent("전통주 DB열어"), "OPEN_TRADITIONAL_LIQUOR_DATABASE");
  assert.equal(detectTraditionalLiquorIntent("전통주 데이터베이스 열어"), "OPEN_TRADITIONAL_LIQUOR_DATABASE");
  assert.equal(detectTraditionalLiquorAnalytics("전통주 DB열어"), null);
});

test("recognizes Traditional Liquor overview requests", () => {
  for (const message of [
    "전통주 데이터 보여줘",
    "전통주 관련 데이터 보여줘",
    "전통주 DB 전체 보여줘",
    "전통주 데이터베이스 열어줘",
    "현재 수집된 전통주 데이터 보여줘",
    "전통주 데이터 한번 보자"
  ]) {
    assert.equal(detectTraditionalLiquorAnalytics(message)?.view, "OVERVIEW", message);
  }
});

test("routes each analytics view before the LLM", () => {
  assert.equal(detectTraditionalLiquorAnalytics("전통주 제품별로 보여줘")?.view, "PRODUCT");
  assert.equal(detectTraditionalLiquorAnalytics("전통주 플랫폼별로 보여줘")?.view, "PLATFORM");
  assert.equal(detectTraditionalLiquorAnalytics("전통주 업체별로 보여줘")?.view, "SELLER");
  assert.equal(detectTraditionalLiquorAnalytics("전통주 가격별로 보여줘")?.view, "PRICE");
  assert.equal(detectTraditionalLiquorAnalytics("전통주 판매량별로 보여줘")?.view, "SALES");
});

test("parses price, platform and sales filters", () => {
  const naverPrice = detectTraditionalLiquorAnalytics("네이버 전통주 가격별로 보여줘");
  assert.equal(naverPrice?.view, "PRICE");
  assert.equal(naverPrice?.filters?.platformCode, "NAVER");
  assert.equal(naverPrice?.filters?.sort, "LOWEST");

  const range = detectTraditionalLiquorAnalytics("카카오톡 선물하기 1만원에서 3만원 사이 전통주");
  assert.equal(range?.filters?.platformCode, "KAKAO_GIFT");
  assert.equal(range?.filters?.minPrice, 10_000);
  assert.equal(range?.filters?.maxPrice, 30_000);

  const sales = detectTraditionalLiquorAnalytics("최근 7일 판매량 증가가 큰 전통주");
  assert.equal(sales?.view, "SALES");
  assert.equal(sales?.filters?.metricType, "SOURCE_PURCHASE_COUNT");
  assert.equal(sales?.filters?.period, "7D");
});

test("retains active analytics state for follow-up controls", () => {
  const initial = detectTraditionalLiquorAnalytics("전통주 가격별로 보여줘");
  assert.ok(initial);
  const platform = detectTraditionalLiquorAnalytics("네이버만 보여줘", initial);
  const maximum = detectTraditionalLiquorAnalytics("3만원 이하만", platform);
  const descending = detectTraditionalLiquorAnalytics("비싼 순으로", maximum);
  assert.equal(descending?.view, "PRICE");
  assert.equal(descending?.filters?.platformCode, "NAVER");
  assert.equal(descending?.filters?.maxPrice, 30_000);
  assert.equal(descending?.filters?.sort, "HIGHEST");
});

test("structured analytics responses persist in saved chat content", () => {
  const response = detectTraditionalLiquorAnalytics("네이버 전통주 가격별로 보여줘");
  assert.ok(response);
  assert.deepEqual(parseTraditionalLiquorAnalytics(serializeTraditionalLiquorAnalytics(response)), response);
  assert.equal(parseTraditionalLiquorAnalytics("normal text"), null);
});
