import assert from "node:assert/strict";
import test from "node:test";
import { detectTraditionalLiquorIntent } from "@/lib/traditional-liquor/intents";

test("accepts only the two exact Traditional Liquor DB commands", () => {
  assert.equal(detectTraditionalLiquorIntent("전통주 DB열어"), "OPEN_TRADITIONAL_LIQUOR_DATABASE");
  assert.equal(detectTraditionalLiquorIntent("전통주 데이터베이스 열어"), "OPEN_TRADITIONAL_LIQUOR_DATABASE");
});

test("rejects similar or conversational commands", () => {
  assert.equal(detectTraditionalLiquorIntent("전통주 DB 열어"), null);
  assert.equal(detectTraditionalLiquorIntent("우혁몬, 전통주 DB열어"), null);
  assert.equal(detectTraditionalLiquorIntent("전통주 db열어"), null);
  assert.equal(detectTraditionalLiquorIntent("전통주 데이터베이스 보여줘"), null);
  assert.equal(detectTraditionalLiquorIntent("전통주를 가격별로 분석해줘"), null);
});
