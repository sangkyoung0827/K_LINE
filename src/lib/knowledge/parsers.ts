import "server-only";

import JSZip from "jszip";
import mammoth from "mammoth";
import type { ParsedDocument } from "@/lib/knowledge/types";

export class UnsupportedKnowledgeFileError extends Error {}

const textExtensions = new Set(["txt", "md", "markdown", "csv", "json", "log", "xml", "yaml", "yml"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"]);
const analyzableImageExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const archiveExtensions = new Set(["zip"]);
const maxParserBytes = 40 * 1024 * 1024;
const maxArchiveEntryBytes = 12 * 1024 * 1024;

function normalizedExtension(name: string, provided?: string) {
  const extension = provided || name.split(".").pop() || "";
  return extension.toLowerCase().replace(/^\./, "");
}

function cleanExtractedText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/<w:tab\s*\/?\s*>/g, "\t")
    .replace(/<a:br\s*\/?\s*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTextNodes(value: string) {
  return Array.from(value.matchAll(/<(?:a:t|w:t|t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:a:t|w:t|t)>/g))
    .map((match) => decodeXml(match[1]))
    .filter(Boolean)
    .join(" ");
}

async function readZipEntry(entry: JSZip.JSZipObject) {
  const internal = entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } };
  if ((internal._data?.uncompressedSize ?? 0) > maxArchiveEntryBytes) {
    throw new Error(`Archive entry is too large to analyze safely: ${entry.name}`);
  }
  const value = await entry.async("string");
  if (Buffer.byteLength(value, "utf8") > maxArchiveEntryBytes) {
    throw new Error(`Archive entry expanded beyond the analysis limit: ${entry.name}`);
  }
  return value;
}

async function parsePdf(buffer: Buffer, name: string): Promise<ParsedDocument> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = cleanExtractedText(result.text);
    return {
      metadata: { pageCount: result.total },
      parserType: "PDFParser",
      sections: [{ content: text, title: name }],
      text,
      title: name.replace(/\.pdf$/i, "")
    };
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer, name: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  const text = cleanExtractedText(result.value);
  return {
    metadata: { warnings: result.messages.map((message) => message.message).slice(0, 20) },
    parserType: "DocxParser",
    sections: [{ content: text, title: name }],
    text,
    title: name.replace(/\.docx$/i, "")
  };
}

async function parsePptx(buffer: Buffer, name: string): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.values(zip.files)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const sections = [];
  for (let index = 0; index < Math.min(slideEntries.length, 500); index += 1) {
    const xml = await readZipEntry(slideEntries[index]);
    const content = cleanExtractedText(xmlTextNodes(xml));
    if (content) sections.push({ content, pageNumber: index + 1, title: `Slide ${index + 1}` });
  }
  const text = sections.map((section) => `${section.title}\n${section.content}`).join("\n\n");
  return {
    metadata: { slideCount: slideEntries.length },
    parserType: "PptxParser",
    sections,
    text,
    title: name.replace(/\.pptx$/i, "")
  };
}

async function parseXlsx(buffer: Buffer, name: string): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedEntry = zip.file("xl/sharedStrings.xml");
  const sharedXml = sharedEntry ? await readZipEntry(sharedEntry) : "";
  const sharedStrings = Array.from(sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)).map(
    (match) => xmlTextNodes(match[1])
  );
  const sheetEntries = Object.values(zip.files)
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const sections = [];
  for (let index = 0; index < Math.min(sheetEntries.length, 100); index += 1) {
    const xml = await readZipEntry(sheetEntries[index]);
    const rows = Array.from(xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g))
      .slice(0, 10000)
      .map((row) =>
        Array.from(row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g))
          .map((cell) => {
            const raw = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? xmlTextNodes(cell[2]);
            if (/t="s"/.test(cell[1])) return sharedStrings[Number(raw)] ?? raw;
            return decodeXml(raw);
          })
          .join("\t")
      );
    const content = cleanExtractedText(rows.join("\n"));
    if (content) sections.push({ content, pageNumber: index + 1, title: `Sheet ${index + 1}` });
  }
  const text = sections.map((section) => `${section.title}\n${section.content}`).join("\n\n");
  return {
    metadata: { sheetCount: sheetEntries.length },
    parserType: "SpreadsheetParser",
    sections,
    text,
    title: name.replace(/\.xlsx$/i, "")
  };
}

async function parseZip(buffer: Buffer, name: string): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).slice(0, 5000);
  const text = entries
    .map((entry) => `${entry.dir ? "Folder" : "File"}: ${entry.name}`)
    .join("\n");
  return {
    metadata: { entryCount: Object.keys(zip.files).length, inventoryOnly: true },
    parserType: "ArchiveParser",
    sections: [{ content: text, title: "Archive inventory" }],
    text,
    title: name.replace(/\.zip$/i, "")
  };
}

export function isKnowledgeImage(name: string, mimeType: string, extension?: string) {
  return mimeType.startsWith("image/") || imageExtensions.has(normalizedExtension(name, extension));
}

export async function parseKnowledgeFile(input: {
  buffer: Buffer;
  extension: string;
  mimeType: string;
  name: string;
}): Promise<ParsedDocument> {
  const extension = normalizedExtension(input.name, input.extension);
  if (input.buffer.byteLength > maxParserBytes) {
    throw new UnsupportedKnowledgeFileError(
      "원본 저장 완료 / 현재 분석 미지원: 이 파일은 서버 분석 한도를 초과합니다."
    );
  }
  if (isKnowledgeImage(input.name, input.mimeType, extension)) {
    if (!analyzableImageExtensions.has(extension) && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(input.mimeType)) {
      throw new UnsupportedKnowledgeFileError("원본 저장 완료 / 현재 이미지 분석 미지원");
    }
    return {
      metadata: {},
      parserType: "ImageParser",
      sections: [],
      text: "",
      title: input.name.replace(/\.[^.]+$/, "")
    };
  }
  if (textExtensions.has(extension) || input.mimeType.startsWith("text/")) {
    const text = cleanExtractedText(input.buffer.toString("utf8"));
    return {
      metadata: {},
      parserType: extension === "csv" ? "SpreadsheetParser" : "TextParser",
      sections: [{ content: text, title: input.name }],
      text,
      title: input.name.replace(/\.[^.]+$/, "")
    };
  }
  if (extension === "pdf" || input.mimeType === "application/pdf") return parsePdf(input.buffer, input.name);
  if (extension === "docx") return parseDocx(input.buffer, input.name);
  if (extension === "pptx") return parsePptx(input.buffer, input.name);
  if (extension === "xlsx") return parseXlsx(input.buffer, input.name);
  if (archiveExtensions.has(extension)) return parseZip(input.buffer, input.name);
  throw new UnsupportedKnowledgeFileError("원본 저장 완료 / 현재 분석 미지원");
}
