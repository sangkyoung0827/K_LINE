import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();

test("Traditional Liquor database exposes five ordered analytics views", async () => {
  const source = await readFile(`${root}/src/components/traditional-liquor/TraditionalLiquorDatabase.tsx`, "utf8");
  const labels = [...source.matchAll(/id: "(product|platform|seller|price|sales)", label: "([^"]+)"/g)].map((match) => match[2]);
  assert.deepEqual(labels, ["제품별", "플랫폼별", "업체별", "가격별", "판매량별"]);
});

test("analytics SQL is paginated and excludes uncommitted imports", async () => {
  const sql = await readFile(`${root}/supabase/traditional_liquor_analytics_views.sql`, "utf8");
  assert.match(sql, /traditional_liquor_market_metrics_history/);
  assert.match(sql, /status = 'COMPLETED' and [\s\S]*production_committed_at is not null/);
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 50\), 1\), 50\)/);
  assert.match(sql, /interval '7 days'/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /h\.observed_at <= l\.observed_at - interval '7 days'/);
  assert.match(sql, /h\.observed_at <= l\.observed_at - interval '30 days'/);
  assert.match(sql, /order by h\.observed_at desc/);
  assert.match(sql, /data_status/);
  assert.match(sql, /INSUFFICIENT_DATA/);
  assert.match(sql, /then s\.metric_value - s\.baseline_value else null/);
  assert.match(sql, /source_entity_id/);
  assert.match(sql, /traditional_liquor_metrics_source_snapshot_uidx/);
  assert.match(sql, /on conflict do nothing/);
  assert.match(sql, /trg_capture_traditional_liquor_batch_metrics/);
  assert.match(sql, /history_points/);
});

test("market offer import maps cumulative sales and popularity snapshots", async () => {
  const mapping = await readFile(`${root}/src/lib/traditional-liquor/import/column-mapping.ts`, "utf8");
  const normalization = await readFile(`${root}/src/lib/traditional-liquor/import/real-normalization.ts`, "utf8");
  const repository = await readFile(`${root}/src/lib/traditional-liquor/import/real-import-repository.ts`, "utf8");
  for (const field of ["source_purchase_count", "wish_count", "review_count", "gift_rank", "source_entity_id"]) {
    assert.match(mapping, new RegExp(field));
  }
  assert.match(normalization, /sourcePurchaseCount/);
  assert.match(normalization, /metricScope/);
  for (const metric of ["SOURCE_PURCHASE_COUNT", "KEEP_COUNT", "REVIEW_COUNT", "WISH_COUNT", "SEARCH_RANK", "GIFT_RANK", "CATEGORY_RANK"]) {
    assert.match(repository, new RegExp(metric));
  }
  assert.match(repository, /resolution=ignore-duplicates/);
});

test("Kakao popularity remains distinct from purchase volume", async () => {
  const ui = await readFile(`${root}/src/components/traditional-liquor/TraditionalLiquorSalesAnalytics.tsx`, "utf8");
  assert.match(ui, /위시·리뷰·순위는 인기도 지표이며 실제 판매량으로 해석하지 않습니다/);
  assert.match(ui, /KAKAO_GIFT/);
  assert.match(ui, /WISH_COUNT/);
  assert.match(ui, /비교 가능한 이전 데이터가 없습니다/);
  assert.doesNotMatch(ui, /enableSalesDelta|manual.*enable/i);
  assert.match(ui, /row\.dataStatus !== "AVAILABLE"/);
});

test("read-only analytics APIs are public server routes while management stays developer-only", async () => {
  for (const view of ["price", "sales"]) {
    const source = await readFile(`${root}/src/app/api/v4/traditional-liquor/analytics/${view}/route.ts`, "utf8");
    assert.doesNotMatch(source, /requireWoohyukmonV4DeveloperApi|requireWoohyukmonV4AuthenticatedApi/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
  const market = await readFile(`${root}/src/app/api/v4/traditional-liquor/market/route.ts`, "utf8");
  const importer = await readFile(`${root}/src/app/api/v4/traditional-liquor/import/route.ts`, "utf8");
  assert.doesNotMatch(market, /requireWoohyukmonV4DeveloperApi|requireWoohyukmonV4AuthenticatedApi/);
  assert.match(importer, /requireWoohyukmonV4DeveloperApi/);
});

test("chat renders the reusable embedded analytics shell before Gemini", async () => {
  const chat = await readFile(`${root}/src/components/WoohyukmonChatbot.tsx`, "utf8");
  const database = await readFile(`${root}/src/components/traditional-liquor/TraditionalLiquorDatabase.tsx`, "utf8");
  assert.match(chat, /detectTraditionalLiquorAnalytics\(trimmed, activeAnalyticsState\)/);
  assert.match(chat, /TraditionalLiquorAnalyticsShell initialState/);
  assert.ok(chat.indexOf("detectTraditionalLiquorAnalytics(trimmed") < chat.indexOf('fetch("/api/gemini"'));
  assert.match(database, /mode="embedded"/);
  assert.match(database, /!embedded \? <><div/);
  assert.match(database, /전체 화면으로 열기/);
});
