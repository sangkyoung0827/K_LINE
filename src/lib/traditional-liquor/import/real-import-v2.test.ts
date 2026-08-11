import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { applyColumnMapping, suggestColumnMapping } from "@/lib/traditional-liquor/import/column-mapping";
import { resolveImportRow, type ResolutionEntities } from "@/lib/traditional-liquor/import/entity-resolution";
import { parseImportFile, parseJsonBuffer } from "@/lib/traditional-liquor/import/file-parsers";
import { detectImportType } from "@/lib/traditional-liquor/import/import-type-detection";
import { createImportPreview } from "@/lib/traditional-liquor/import/import-preview";
import { normalizeRealImportRecord, validateRealImportRecord } from "@/lib/traditional-liquor/import/real-normalization";

const entities: ResolutionEntities = {
  breweries: [{ id: "brewery-1", name: "명인 양조장", normalized_name: "명인 양조장", region: "안동", province: "경북", city: "안동" }],
  products: [{ id: "product-1", brewery_id: "brewery-1", name: "명인 안동소주", canonical_name: "명인 안동소주", normalized_name: "명인 안동소주", abv: 45, volume_ml: 375 }],
  sellers: [{ id: "seller-1", name: "우리술상회", normalized_name: "우리술상회" }],
  platforms: [{ id: "platform-1", code: "NAVER", name: "네이버" }],
  productAliases: [],
  sellerAliases: [{ seller_id: "seller-1", normalized_alias: "우리 술 상회" }]
};

function marketRow(overrides: Record<string, unknown> = {}) {
  return { importType: "MARKET_OFFER", productName: "명인 안동소주", normalizedProductName: "명인 안동소주", listingVolumeMl: 375, platformCode: "NAVER", sellerName: "우리술상회", normalizedSellerName: "우리술상회", ...overrides };
}

function xml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function columnName(index: number) {
  let value = "";
  for (let cursor = index + 1; cursor > 0; cursor = Math.floor((cursor - 1) / 26)) value = String.fromCharCode(65 + ((cursor - 1) % 26)) + value;
  return value;
}

async function xlsxFile(rows: unknown[][], sheetName = "Import") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join("")}</row>`).join("");
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([arrayBuffer], "market-offers.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

test("TEST 1: CSV PRODUCT_MASTER 3-row import", async () => {
  const csv = "제품명,제조사,도수,용량\n가주,가양조장,10,375\n나주,나양조장,12,500\n다주,다양조장,15,750\n";
  const parsed = await parseImportFile(new File([csv], "products.csv", { type: "text/csv" }), "PRODUCT_MASTER", "직접 조사");
  assert.equal(parsed.records.length, 3);
  assert.deepEqual(suggestColumnMapping(parsed.headers, "PRODUCT_MASTER"), { 제품명: "product_name", 제조사: "brewery_name", 도수: "abv", 용량: "volume_ml" });
});

test("TEST 2: XLSX MARKET_OFFER 3-row import", async () => {
  const file = await xlsxFile([["판매상품명", "플랫폼", "판매처", "가격", "상품url"], ["가주", "NAVER", "가게", "10000", "https://example.com/a"], ["나주", "NAVER", "가게", "11000", "https://example.com/b"], ["다주", "NAVER", "가게", "12000", "https://example.com/c"]], "MARKET_OFFER");
  const parsed = await parseImportFile(file, "PRODUCT_MASTER", "XLSX TEST");
  assert.equal(parsed.fileType, "XLSX");
  assert.equal(parsed.importType, "MARKET_OFFER");
  assert.equal(parsed.hasTypeConflict, true);
  assert.equal(parsed.sheetName, "MARKET_OFFER");
  assert.equal(parsed.records.length, 3);
});

test("TEST 3: JSON MARKET_OFFER import", () => {
  const parsed = parseJsonBuffer(Buffer.from(JSON.stringify([{ listing_title: "가주", platform_code: "NAVER" }, { listing_title: "나주", platform_code: "NAVER" }])), "offers.json", "MARKET_OFFER", "JSON TEST");
  assert.equal(parsed.records.length, 2);
  assert.ok(parsed.headers.includes("listing_title"));
});

test("TEST 4: existing Product exact SKU is matched", () => {
  const result = resolveImportRow(marketRow({ breweryName: "명인 양조장", normalizedBreweryName: "명인 양조장", abv: 45 }), entities);
  assert.equal(result.productId, "product-1");
  assert.equal(result.status, "MATCHED");
});

test("TEST 5: absent Product becomes NEW_ENTITY", () => {
  const result = resolveImportRow(marketRow({ productName: "새 전통주", normalizedProductName: "새 전통주" }), entities);
  assert.equal(result.productId, null);
  assert.equal(result.status, "NEW_ENTITY");
});

test("TEST 6: same-name Product with conflicting SKU requires review", () => {
  const result = resolveImportRow(marketRow({ listingVolumeMl: 750 }), entities);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.details.reasons.includes("AMBIGUOUS_PRODUCT"));
});

test("TEST 7: Seller alias exact match is deterministic", () => {
  const result = resolveImportRow(marketRow({ sellerName: "우리 술 상회", normalizedSellerName: "우리 술 상회" }), entities);
  assert.equal(result.sellerId, "seller-1");
  assert.equal(result.status, "MATCHED");
});

test("TEST 8: absent Seller remains NEW_ENTITY", () => {
  const result = resolveImportRow(marketRow({ sellerName: "신규 판매점", normalizedSellerName: "신규 판매점" }), entities);
  assert.equal(result.sellerId, null);
  assert.equal(result.status, "NEW_ENTITY");
});

test("TEST 9: unknown Platform always requires manual review", () => {
  const result = resolveImportRow(marketRow({ platformCode: "UNKNOWN_PLATFORM" }), entities);
  assert.equal(result.status, "MANUAL_REVIEW");
  assert.ok(result.details.reasons.includes("UNKNOWN_PLATFORM"));
});

test("TEST 10: staging API does not write Production tables before commit", async () => {
  const source = await readFile(join(process.cwd(), "src/app/api/v4/traditional-liquor/import/route.ts"), "utf8");
  assert.ok(source.includes("stageFile"));
  assert.ok(!/traditional_liquor_(products|offers|price_history).*method:\s*[\"']POST/.test(source));
});

test("TEST 11: atomic RPC creates Product, Seller and Offer", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/traditional_liquor_real_import_v2.sql"), "utf8");
  assert.match(sql, /insert into public\.traditional_liquor_products/);
  assert.match(sql, /insert into public\.traditional_liquor_sellers/);
  assert.match(sql, /insert into public\.traditional_liquor_offers/);
  assert.match(sql, /security definer/);
});

test("TEST 12: existing Offer update preserves first_seen_at", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/traditional_liquor_real_import_v2.sql"), "utf8");
  const update = sql.match(/update public\.traditional_liquor_offers set([\s\S]*?)where id = v_offer_id;/)?.[1] ?? "";
  assert.ok(update.includes("last_seen_at"));
  assert.ok(!update.includes("first_seen_at"));
});

test("TEST 13: Price History records change or first daily observation", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/traditional_liquor_real_import_v2.sql"), "utf8");
  assert.match(sql, /v_history_needed := v_existing_offer\.price is distinct from/);
  assert.match(sql, /observed_at::date = v_observed_at::date/);
  assert.match(sql, /insert into public\.traditional_liquor_price_history/);
});

test("TEST 14: repeated import deduplicates Offer by external id or listing URL", async () => {
  const sql = await readFile(join(process.cwd(), "supabase/traditional_liquor_real_import_v2.sql"), "utf8");
  assert.match(sql, /platform_id = v_platform_id and external_offer_id =/);
  assert.match(sql, /platform_id = v_platform_id and external_offer_id is null and listing_url =/);
});

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}

test("TEST 15: service role key is absent from client source", async () => {
  const files = (await sourceFiles(join(process.cwd(), "src/components"))).filter((file) => /\.(tsx?|jsx?)$/.test(file));
  for (const file of files) assert.doesNotMatch(await readFile(file, "utf8"), /SUPABASE_SERVICE_ROLE_KEY|sb_secret_/);
});

test("TEST 16: Fixture regression assets and V1 suite remain installed", async () => {
  assert.ok((await readFile(join(process.cwd(), "fixtures/traditional-liquor-shop.html"), "utf8")).includes("명인 안동소주"));
  assert.ok((await readFile(join(process.cwd(), "src/lib/traditional-liquor/collection/collection-engine.test.ts"), "utf8")).includes("FixtureCollectionAdapter"));
});

test("TEST 17: product_name alone never classifies PRODUCT_MASTER", () => {
  assert.equal(detectImportType(["product_name"]).importType, null);
  assert.equal(detectImportType(["product_name", "brewery_name", "abv"]).importType, "PRODUCT_MASTER");
});

test("TEST 18: MARKET_OFFER preview falls back to nested raw_data", () => {
  const preview = createImportPreview("MARKET_OFFER", {}, { rawData: { listing_title: "금정산성 막걸리", seller_name: "술마켓", price: 2800, platform_code: "NAVER", volume_ml: 750, quantity: 1, listing_url: "https://example.com" } });
  assert.equal(preview.title, "금정산성 막걸리");
  assert.equal(preview.seller, "술마켓");
  assert.equal(preview.price, 2800);
  assert.equal(preview.platform, "NAVER");
});

const actualMarketOfferPath = "/Users/chogihwa/Downloads/woo_hyukmon_naver_traditional_liquor_market_offer_2026-08-11.xlsx";
test("TEST 19: supplied 148-row MARKET_OFFER workbook is detected and validates", { skip: !existsSync(actualMarketOfferPath) }, async () => {
  const bytes = await readFile(actualMarketOfferPath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], basename(actualMarketOfferPath), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const parsed = await parseImportFile(file, "PRODUCT_MASTER", "NAVER SHOPPING");
  assert.equal(parsed.importType, "MARKET_OFFER");
  assert.equal(parsed.detectedImportType, "MARKET_OFFER");
  assert.equal(parsed.sheetName, "MARKET_OFFER");
  assert.equal(parsed.records.length, 148);
  const mapping = suggestColumnMapping(parsed.headers, parsed.importType);
  assert.equal(mapping.seller_name, "seller_name");
  assert.equal(mapping.price, "price");
  assert.equal(mapping.platform_code, "platform_code");
  const results = parsed.records.map((record) => {
    const mapped = applyColumnMapping(record, mapping, "NAVER SHOPPING");
    const normalized = normalizeRealImportRecord(mapped);
    return { normalized, validation: validateRealImportRecord(normalized), preview: createImportPreview("MARKET_OFFER", normalized, record.rawData, mapping) };
  });
  assert.equal(results.filter(({ validation }) => validation.status === "VALID").length, 148);
  assert.equal(results.filter(({ preview }) => !preview.seller || preview.price === null || !preview.platform).length, 0);
  assert.deepEqual(results.slice(0, 5).map(({ preview }) => [preview.seller, preview.price]), [["11번가", 2980], ["DOSU", 2900], ["별주막닷컴", 2890], ["술마켓", 2800], ["쿠팡", 2900]]);
});
