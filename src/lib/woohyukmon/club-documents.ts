import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";

export type DocumentRow = Record<string, string | number | boolean | null>;
const secretKey = /secret|token|password|api.?key|encrypted|refresh|cookie|authorization/i;

export function documentRows(value: unknown, parent = ""): DocumentRow[] {
  if (Array.isArray(value)) return value.flatMap((item) => documentRows(item, parent));
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !secretKey.test(key) && !["access", "connection", "nextOffset", "hasMore", "canManage", "canUpload"].includes(key));
  const flat = Object.fromEntries(entries.filter(([, item]) => item === null || ["string", "number", "boolean"].includes(typeof item))) as DocumentRow;
  const nested = entries.filter(([, item]) => item && typeof item === "object").flatMap(([key, item]) => documentRows(item, parent ? `${parent}.${key}` : key));
  return [...(Object.keys(flat).length ? [{ ...flat, ...(parent ? { 자료: parent } : {}) }] : []), ...nested];
}

export async function createClubDocument(format: "xlsx" | "docx", title: string, rows: DocumentRow[]) {
  if (rows.length > 20000) throw new Error("자료가 너무 많습니다. 범위를 나누어 요청해 주세요.");
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => !secretKey.test(key));
  if (columns.length > 40) throw new Error("자료 항목이 너무 많습니다. 기능별로 나누어 내보내 주세요.");
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("K_LINE", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = columns.map(key => ({ header: key, key, width: 24 }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(columns.map(key => String(row[key] ?? "")));
    // Literal string values, including leading-zero IDs and formula-looking names.
    sheet.eachRow(row => row.eachCell(cell => { cell.numFmt = "@"; cell.alignment = { vertical: "top", wrapText: true }; }));
    if (columns.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
    return { bytes: new Uint8Array(await workbook.xlsx.writeBuffer()), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  const cells = (values: string[], bold = false) => new TableRow({ children: values.map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold })] })] })) });
  // A compact Word report avoids a 40-column table that cannot fit on a page.
  const children: (Paragraph | Table)[] = [new Paragraph({ text: title, heading: "Heading1" }), new Paragraph(`K_LINE · ${new Date().toISOString()} · ${rows.length} records`)];
  for (const row of rows) children.push(new Table({ rows: [cells(["항목 / Field", "내용 / Value"], true), ...columns.filter(key => row[key] !== undefined).map(key => cells([key, String(row[key] ?? "")]))] }), new Paragraph(""));
  if (!rows.length) children.push(new Paragraph("표시할 자료가 없습니다. / No records found."));
  return { bytes: new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] }))), mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}
