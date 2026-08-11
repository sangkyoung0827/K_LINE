import { parse as parseCsv } from "csv-parse/sync";
import readXlsxFile from "read-excel-file/node";
import { detectImportType } from "@/lib/traditional-liquor/import/import-type-detection";
import type { ImportFileType, ParsedImportFile, RawImportRecord, RealImportType } from "@/lib/traditional-liquor/import/real-import-types";

const maxRows = 10_000;
// Vercel functions reject larger request bodies before this route can parse them.
const maxFileBytes = 4 * 1024 * 1024;

export interface ParseImportOptions {
  forceImportType?: boolean;
  sheetName?: string;
}

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

function buildParsedFile(args: {
  fileType: ImportFileType;
  fileName: string;
  headers: string[];
  objects: Array<Record<string, unknown>>;
  requestedImportType: RealImportType;
  sourceName?: string;
  forceImportType?: boolean;
  sheetName?: string;
  sheetNames?: string[];
}): ParsedImportFile {
  const detection = detectImportType(args.headers, args.sheetName);
  const importType = args.forceImportType ? args.requestedImportType : detection.importType ?? args.requestedImportType;
  const mismatch = detection.importType !== null && detection.importType !== args.requestedImportType;
  return {
    fileType: args.fileType,
    fileName: args.fileName,
    importType,
    requestedImportType: args.requestedImportType,
    detectedImportType: detection.importType,
    hasTypeConflict: mismatch && !args.forceImportType,
    typeOverrideApplied: mismatch && Boolean(args.forceImportType),
    detectionConfidence: detection.confidence,
    detectionReasons: detection.reasons,
    sheetName: args.sheetName,
    sheetNames: args.sheetNames,
    headers: args.headers,
    records: recordsFromObjects(args.objects, importType, args.sourceName)
  };
}

export async function parseImportFile(file: File, requestedImportType: RealImportType, sourceName?: string, options: ParseImportOptions = {}): Promise<ParsedImportFile> {
  if (file.size > maxFileBytes) throw new Error("Import file exceeds the 4MB server upload limit.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  if (extension === "csv") {
    const rows = parseCsv(buffer, { bom: true, relax_column_count: true, skip_empty_lines: true }) as unknown[][];
    const parsed = rowsToObjects(rows);
    return buildParsedFile({ fileType: "CSV", fileName: file.name, headers: parsed.headers, objects: parsed.objects, requestedImportType, sourceName, forceImportType: options.forceImportType });
  }
  if (extension === "xlsx") {
    const sheets = await readXlsxFile(buffer);
    if (!sheets.length) throw new Error("The XLSX file has no readable sheets.");
    const candidates = sheets.map((sheet, index) => {
      const parsed = rowsToObjects(sheet.data as unknown[][]);
      const detection = detectImportType(parsed.headers, sheet.sheet);
      return { index, sheetName: sheet.sheet, parsed, detection };
    });
    const selected = options.sheetName
      ? candidates.find((candidate) => candidate.sheetName === options.sheetName)
      : [...candidates].sort((left, right) => right.detection.score - left.detection.score || left.index - right.index)[0];
    if (!selected) throw new Error("The requested XLSX sheet was not found.");
    return buildParsedFile({
      fileType: "XLSX", fileName: file.name, headers: selected.parsed.headers, objects: selected.parsed.objects,
      requestedImportType, sourceName, forceImportType: options.forceImportType, sheetName: selected.sheetName, sheetNames: sheets.map((sheet) => sheet.sheet)
    });
  }
  if (extension === "json") return parseJsonBuffer(buffer, file.name, requestedImportType, sourceName, options);
  throw new Error("Only CSV, XLSX, and JSON files are supported.");
}

export function parseJsonBuffer(buffer: Buffer, fileName: string, requestedImportType: RealImportType, sourceName?: string, options: ParseImportOptions = {}): ParsedImportFile {
  if (buffer.byteLength > maxFileBytes) throw new Error("Import file exceeds the 4MB server upload limit.");
  const decoded = JSON.parse(buffer.toString("utf8")) as unknown;
  const rows = Array.isArray(decoded) ? decoded : typeof decoded === "object" && decoded && Array.isArray((decoded as { records?: unknown }).records) ? (decoded as { records: unknown[] }).records : null;
  if (!rows || !rows.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))) throw new Error("JSON must be an array of objects or an object with a records array.");
  const objects = rows as Array<Record<string, unknown>>;
  const headers = [...new Set(objects.flatMap((row) => Object.keys(row)))];
  return buildParsedFile({ fileType: "JSON", fileName, headers, objects, requestedImportType, sourceName, forceImportType: options.forceImportType });
}

export function sourceTypeForFile(fileType: ImportFileType) {
  return fileType === "JSON" ? "MANUAL" : fileType;
}
