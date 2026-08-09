import type { ParsedDocument } from "@/lib/knowledge/types";

export type KnowledgeChunkInput = {
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
  pageNumber?: number;
  section?: string;
};

const targetCharacters = 4200;
const minimumCharacters = 300;
const maximumChunks = 600;

function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n|(?<=[.!?。！？])\s+(?=[A-Z가-힣0-9])/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function chunkParsedDocument(document: ParsedDocument): KnowledgeChunkInput[] {
  const chunks: KnowledgeChunkInput[] = [];
  const sections = document.sections.length > 0
    ? document.sections
    : [{ content: document.text, title: document.title }];

  for (const section of sections) {
    let current = "";
    for (const paragraph of splitParagraphs(section.content)) {
      if (current && current.length + paragraph.length + 2 > targetCharacters) {
        chunks.push({
          chunkIndex: chunks.length,
          content: current,
          metadata: { sourceType: "SOURCE" },
          pageNumber: section.pageNumber,
          section: section.title
        });
        current = "";
      }
      if (paragraph.length > targetCharacters * 2) {
        for (let offset = 0; offset < paragraph.length; offset += targetCharacters) {
          const slice = paragraph.slice(offset, offset + targetCharacters).trim();
          if (slice) {
            chunks.push({
              chunkIndex: chunks.length,
              content: slice,
              metadata: { sourceType: "SOURCE" },
              pageNumber: section.pageNumber,
              section: section.title
            });
          }
        }
      } else {
        current = [current, paragraph].filter(Boolean).join("\n\n");
      }
      if (chunks.length >= maximumChunks) return chunks;
    }
    if (current.length >= minimumCharacters || (current && chunks.length === 0)) {
      chunks.push({
        chunkIndex: chunks.length,
        content: current,
        metadata: { sourceType: "SOURCE" },
        pageNumber: section.pageNumber,
        section: section.title
      });
    }
    if (chunks.length >= maximumChunks) return chunks;
  }
  return chunks;
}
