import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { FixtureCollectionAdapter, ManualImportAdapter } from "@/lib/traditional-liquor/collection/adapters";
import { FixtureBrowserSiteAdapter } from "@/lib/traditional-liquor/collection/fixture-browser-adapter";
import { normalizeOffer, parsePrice, parseVolumeAndQuantity } from "@/lib/traditional-liquor/collection/normalization";
import { QueryEngine, seedCollectionQueries, type QueryRepository } from "@/lib/traditional-liquor/collection/queries";
import type { CollectionQuery, ValidatedOffer } from "@/lib/traditional-liquor/collection/types";
import { CollectionEngine, ImportPipeline } from "@/lib/traditional-liquor/import/pipeline";
import type { CollectionRunRecord, ImportBatchRecord, ImportPreview, StagingRowRecord, TraditionalLiquorImportRepository } from "@/lib/traditional-liquor/import/types";

const query: CollectionQuery = { id: "q-1", query: "전통주", queryType: "GENERAL", priority: 100, enabled: true, lastCollectedAt: null };

class MemoryRepository implements TraditionalLiquorImportRepository {
  batches: ImportBatchRecord[] = [];
  rows: StagingRowRecord[] = [];
  errors: ImportPreview["errors"] = [];
  runs: CollectionRunRecord[] = [];
  writes: string[] = [];
  async ensureSource() { this.writes.push("traditional_liquor_data_sources"); return "source-1"; }
  async createBatch(sourceId: string, startedAt: string) { const batch = { id: "batch-1", sourceId, status: "PENDING", totalRows: 0, validRows: 0, invalidRows: 0, startedAt, finishedAt: null, createdAt: startedAt }; this.batches.push(batch); this.writes.push("traditional_liquor_import_batches"); return batch; }
  async createRun(inputQuery: CollectionQuery, batchId: string, sourceCode: string, startedAt: string) { const run: CollectionRunRecord = { id: "run-1", queryId: inputQuery.id, batchId, queryText: inputQuery.query, sourceCode, status: "RUNNING", offersFound: 0, validOffers: 0, invalidOffers: 0, startedAt, finishedAt: null, errorCode: null, errorMessage: null }; this.runs.push(run); this.writes.push("traditional_liquor_collection_runs"); return run; }
  async updateRun(id: string, update: Partial<CollectionRunRecord>) { Object.assign(this.runs.find((item) => item.id === id)!, update); this.writes.push("traditional_liquor_collection_runs"); }
  async updateBatch(id: string, update: Partial<ImportBatchRecord>) { Object.assign(this.batches.find((item) => item.id === id)!, update); this.writes.push("traditional_liquor_import_batches"); }
  async insertStagingRow(batchId: string, rowNumber: number, offer: ValidatedOffer) { const row: StagingRowRecord = { id: `row-${rowNumber}`, batchId, rowNumber, rawData: offer.raw, normalizedData: offer.normalized, validationStatus: offer.status, resolutionStatus: "UNRESOLVED", createdAt: new Date().toISOString() }; this.rows.push(row); this.writes.push("traditional_liquor_import_staging_rows"); return row; }
  async insertErrors(_batchId: string, _stagingId: string, rowNumber: number, offer: ValidatedOffer) { this.errors.push(...offer.issues.map((item) => ({ ...item, rowNumber }))); if (offer.issues.length) this.writes.push("traditional_liquor_import_errors"); }
  async listBatches() { return this.batches; }
  async getPreview() { return { batch: this.batches[0], rows: this.rows, errors: this.errors }; }
}

test("seed dictionary is priority ordered by QueryEngine", async () => {
  assert.ok(seedCollectionQueries.length >= 14);
  const repository: QueryRepository = { list: async () => seedCollectionQueries.map((item, index) => ({ ...item, id: `q-${index}` })), create: async () => { throw new Error("unused"); }, update: async () => { throw new Error("unused"); }, markCollected: async () => undefined };
  assert.equal((await new QueryEngine(repository).next(1))[0].query, "전통주");
});

test("deterministic price and volume normalization", () => {
  assert.equal(parsePrice("19,000원"), 19000);
  assert.deepEqual(parseVolumeAndQuantity("375ml × 2", null), { listingVolumeMl: 375, quantity: 2, totalVolumeMl: 750 });
});

test("fixture collection passes through staging without production writes", async () => {
  const repository = new MemoryRepository();
  const result = await new CollectionEngine(new ImportPipeline(repository), [new FixtureCollectionAdapter()]).collect("FIXTURE_BROWSER_V1", query);
  assert.ok(result.total >= 3);
  assert.ok(result.valid >= 3);
  assert.ok(result.invalid >= 1);
  assert.equal(repository.rows.length, result.total);
  assert.equal(repository.batches[0].status, "READY");
  assert.deepEqual(repository.writes.filter((name) => name === "traditional_liquor_products" || name === "traditional_liquor_offers" || name === "traditional_liquor_price_history"), []);
  assert.equal(repository.rows[0].normalizedData.price, 19000);
});

test("Playwright extracts at least three RawCollectedOffer rows from fixture HTML", async () => {
  const html = await readFile(join(process.cwd(), "fixtures/traditional-liquor-shop.html"), "utf8");
  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    const adapter = new FixtureBrowserSiteAdapter("about:blank");
    await adapter.waitForResults(page);
    const offers = await adapter.extractOffers(page, query);
    assert.ok(offers.length >= 3);
    assert.equal(offers[0].listingTitle, "명인 안동소주 45도");
    assert.equal(normalizeOffer(offers[0]).price, 19000);
    const repository = new MemoryRepository();
    const result = await new CollectionEngine(new ImportPipeline(repository), [new ManualImportAdapter(offers)]).collect("MANUAL_IMPORT", query);
    assert.equal(result.total, offers.length);
    assert.equal(repository.rows.length, offers.length);
    assert.equal(repository.batches[0].status, "READY");
  } finally { await browser.close(); }
});
