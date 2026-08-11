import type { CollectionAdapter } from "@/lib/traditional-liquor/collection/adapters";
import { normalizeOffer } from "@/lib/traditional-liquor/collection/normalization";
import type { CollectionQuery, CollectionResult } from "@/lib/traditional-liquor/collection/types";
import { validateRawOffer } from "@/lib/traditional-liquor/collection/validation";
import type { TraditionalLiquorImportRepository } from "@/lib/traditional-liquor/import/types";

export class ImportPipeline {
  constructor(private readonly repository: TraditionalLiquorImportRepository) {}

  async run(adapter: CollectionAdapter, query: CollectionQuery): Promise<CollectionResult> {
    if (!adapter.supports(query)) throw new Error(`Adapter ${adapter.sourceCode} does not support this query.`);
    const startedAt = new Date().toISOString();
    const sourceId = await this.repository.ensureSource(adapter.sourceCode, "COLLECTOR", "Traditional Liquor Collection Engine V1 staging source");
    const batch = await this.repository.createBatch(sourceId, startedAt);
    const run = await this.repository.createRun(query, batch.id, adapter.sourceCode, startedAt);

    try {
      await this.repository.updateBatch(batch.id, { status: "PARSING" });
      const rawOffers = await adapter.collect(query);
      await this.repository.updateBatch(batch.id, { status: "VALIDATING", totalRows: rawOffers.length });
      let valid = 0;
      let invalid = 0;

      for (const [index, raw] of rawOffers.entries()) {
        const validated = validateRawOffer(raw, normalizeOffer(raw));
        if (validated.status === "VALID") valid += 1; else invalid += 1;
        const staging = await this.repository.insertStagingRow(batch.id, index + 1, validated);
        await this.repository.insertErrors(batch.id, staging.id, index + 1, validated);
      }

      const finishedAt = new Date().toISOString();
      await this.repository.updateBatch(batch.id, { status: "READY", totalRows: rawOffers.length, validRows: valid, invalidRows: invalid, finishedAt });
      await this.repository.updateRun(run.id, { status: "READY", offersFound: rawOffers.length, validOffers: valid, invalidOffers: invalid, finishedAt });
      return { batchId: batch.id, sourceName: adapter.sourceCode, query, total: rawOffers.length, valid, invalid, status: "READY" };
    } catch (error) {
      await this.repository.updateBatch(batch.id, { status: "FAILED", finishedAt: new Date().toISOString() }).catch(() => undefined);
      await this.repository.updateRun(run.id, { status: "FAILED", finishedAt: new Date().toISOString(), errorCode: "COLLECTION_RUN_FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown collection error" }).catch(() => undefined);
      throw error;
    }
  }
}

export class CollectionEngine {
  constructor(private readonly pipeline: ImportPipeline, private readonly adapters: CollectionAdapter[]) {}
  async collect(sourceCode: string, query: CollectionQuery) {
    const adapter = this.adapters.find((item) => item.sourceCode === sourceCode);
    if (!adapter) throw new Error(`Unknown collection adapter: ${sourceCode}`);
    return this.pipeline.run(adapter, query);
  }
}
