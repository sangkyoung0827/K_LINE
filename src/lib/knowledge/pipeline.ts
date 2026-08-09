import "server-only";

import { analyzeKnowledgeSource, embedKnowledgeTexts } from "@/lib/knowledge/ai";
import { chunkParsedDocument, type KnowledgeChunkInput } from "@/lib/knowledge/chunking";
import { parseKnowledgeFile, UnsupportedKnowledgeFileError, isKnowledgeImage } from "@/lib/knowledge/parsers";
import {
  clearDerivedKnowledge,
  failKnowledgeJob,
  finishKnowledgeJob,
  getKnowledgeFile,
  insertKnowledgeChunks,
  linkRelatedKnowledgeFiles,
  saveKnowledgeEntities,
  startKnowledgeJob,
  updateKnowledgeFile
} from "@/lib/knowledge/repository";
import { downloadKnowledgeObject } from "@/lib/knowledge/storage";

async function runStage<T>(fileId: string, stage: string, task: () => Promise<T>) {
  const job = await startKnowledgeJob(fileId, stage);
  try {
    const result = await task();
    await finishKnowledgeJob(job.id);
    return result;
  } catch (error) {
    await failKnowledgeJob(job.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function processKnowledgeFile(fileId: string) {
  const file = await getKnowledgeFile(fileId);
  if (!file) throw new Error("Knowledge file was not found.");

  await clearDerivedKnowledge(file.id);
  await updateKnowledgeFile(file.id, { processing_error: null, processing_status: "QUEUED" });

  try {
    await updateKnowledgeFile(file.id, { processing_status: "EXTRACTING" });
    const buffer = await runStage(file.id, "download", () => downloadKnowledgeObject(file.storage_path));
    const parsed = await runStage(file.id, "extract", () =>
      parseKnowledgeFile({
        buffer,
        extension: file.extension,
        mimeType: file.mime_type,
        name: file.original_name
      })
    );
    await updateKnowledgeFile(file.id, {
      extracted_text: parsed.text.slice(0, 2_000_000),
      metadata: { ...file.metadata, ...parsed.metadata, sourceType: "SOURCE" },
      parser_type: parsed.parserType
    });

    await updateKnowledgeFile(file.id, { processing_status: "ANALYZING" });
    const image = isKnowledgeImage(file.original_name, file.mime_type, file.extension);
    const { analysis, provider } = await runStage(file.id, "analysis", () =>
      analyzeKnowledgeSource({
        buffer: image ? buffer : undefined,
        mimeType: image ? file.mime_type : undefined,
        name: file.original_name,
        text: parsed.text
      })
    );
    await updateKnowledgeFile(file.id, {
      ai_description: analysis.description,
      ai_summary: analysis.summary,
      confidence: analysis.confidence,
      document_date: analysis.documentDate,
      document_type: analysis.documentType,
      event: analysis.event,
      location: analysis.location,
      metadata: { ...file.metadata, ...parsed.metadata, analysisProvider: provider, sourceType: "AI_EXTRACTED" },
      organization: analysis.organization
    });
    await runStage(file.id, "entities", () => saveKnowledgeEntities(file.id, analysis));
    await runStage(file.id, "relations", () => linkRelatedKnowledgeFiles(file.id, analysis));

    await updateKnowledgeFile(file.id, { processing_status: "CHUNKING" });
    const searchableDocument = image
      ? {
          ...parsed,
          sections: [{ content: `${analysis.summary}\n\n${analysis.description}`, title: "AI image description" }],
          text: `${analysis.summary}\n\n${analysis.description}`
        }
      : parsed;
    const chunks = await runStage(file.id, "chunk", async () => chunkParsedDocument(searchableDocument));
    if (chunks.length === 0) {
      throw new UnsupportedKnowledgeFileError("원본 저장 완료 / 추출 가능한 내용 없음");
    }

    await updateKnowledgeFile(file.id, { processing_status: "EMBEDDING" });
    const embeddedChunks: Array<KnowledgeChunkInput & {
      embedding: number[];
      embeddingModel: string;
      embeddingProvider: string;
      fileId: string;
    }> = [];
    for (let offset = 0; offset < chunks.length; offset += 24) {
      const batch = chunks.slice(offset, offset + 24);
      const embedding = await runStage(file.id, `embedding:${Math.floor(offset / 24) + 1}`, () =>
        embedKnowledgeTexts(batch.map((chunk) => chunk.content))
      );
      embeddedChunks.push(
        ...batch.map((chunk, index) => ({
          ...chunk,
          embedding: embedding.vectors[index],
          embeddingModel: embedding.model,
          embeddingProvider: embedding.provider,
          fileId: file.id,
          metadata: {
            ...chunk.metadata,
            originalName: file.original_name,
            sourceType: image ? "AI_EXTRACTED" : "SOURCE"
          }
        }))
      );
    }

    await updateKnowledgeFile(file.id, { processing_status: "INDEXING" });
    for (let offset = 0; offset < embeddedChunks.length; offset += 50) {
      await runStage(file.id, `index:${Math.floor(offset / 50) + 1}`, () =>
        insertKnowledgeChunks(embeddedChunks.slice(offset, offset + 50))
      );
    }
    const ready = await updateKnowledgeFile(file.id, { processing_status: "READY" });
    return ready;
  } catch (error) {
    const unsupported = error instanceof UnsupportedKnowledgeFileError;
    const message = error instanceof Error ? error.message : "Knowledge processing failed.";
    console.error("Knowledge processing failed", {
      fileId: file.id,
      message,
      status: unsupported ? "UNSUPPORTED" : "FAILED"
    });
    await updateKnowledgeFile(file.id, {
      processing_error: message.slice(0, 2000),
      processing_status: unsupported ? "UNSUPPORTED" : "FAILED"
    });
    throw error;
  }
}
