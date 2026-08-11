import { parse as parseCsv } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import type { ImportFileType, ParsedImportFile, RawImportRecord, RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

const maxRows = 10_000;
// Vercel functions reject larger request bodies before this route can parse them.
const maxFileBytes = 4 * 1024 * 1024;

function recordsFromObjects(rows: Array<Record<string, unknown>>, importType: RealImportType, sourceName?: string): RawImportRecord[] {
  if (rows.length > maxRows) throw new Error(`A single import is limited to ${maxRows} rows.`);
  return rows.map((rawData, index) => ({ importType, rowNumber: index + 2, sourceName, rawData }));
}

function rowsToObjects(rows: unknown[][]) {
  if (!rows.length) return { headers: [] as string[], objects: [] as Array<Record<string, unknown>> };
  const headers = rows[0].map((value) => String(value ?? "").trim());
  if (headers.some((header) => !header)) throw new Error("Every import column must have a header.");
  if (new Set(headers).size !== headers.length) throw new Error("Import column headers must be unique.");
  const objects = rows.slice(1).filter((row) => row.some((value) => value !== null && value !== undefined && String(value).trim() !== "")).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
  return { headers, objects };
}

export async function parseImportFile(file: File, importType: RealImportType, sourceName?: string): Promise<ParsedImportFile> {
  if (file.size > maxFileBytes) throw new Error("Import file exceeds the 4MB server upload limit.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "csv") {
    const rows = parseCsv(buffer, { bom: true, relax_column_count: true, skip_empty_lines: true }) as unknown[][];
    const parsed = rowsToObjects(rows);
    return { fileType: "CSV", fileName: file.name, headers: parsed.headers, records: recordsFromObjects(parsed.objects, importType, sourceName) };
  }
  if (extension === "xlsx") {
    const rows = await readSheet(buffer) as unknown as unknown[][];
    const parsed = rowsToObjects(rows);
    return { fileType: "XLSX", fileName: file.name, headers: parsed.headers, records: recordsFromObjects(parsed.objects, importType, sourceName) };
  }
  if (extension === "json") {
    return parseJsonBuffer(buffer, file.name, importType, sourceName);
  }
  throw new Error("Only CSV, XLSX, and JSON files are supported.");
}

export function parseJsonBuffer(buffer: Buffer, fileName: string, importType: RealImportType, sourceName?: string): ParsedImportFile {
  if (buffer.byteLength > maxFileBytes) throw new Error("Import file exceeds the 4MB server upload limit.");
  const decoded = JSON.parse(buffer.toString("utf8")) as unknown;
  const rows = Array.isArray(decoded) ? decoded : typeof decoded === "object" && decoded && Array.isArray((decoded as { records?: unknown }).records) ? (decoded as { records: unknown[] }).records : null;
  if (!rows || !rows.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))) throw new Error("JSON must be an array of objects or an object with a records array.");
  const objects = rows as Array<Record<string, unknown>>;
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  return { fileType: "JSON", fileName, headers, records: recordsFromObjects(objects, importType, sourceName) };
}

export function sourceTypeForFile(fileType: ImportFileType) {
  return fileType === "JSON" ? "MANUAL" : fileType;
}
