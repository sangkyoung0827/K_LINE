import JSZip from "jszip";

export type MemberRosterEntry = { studentId: string; fullName: string };
export const memberRosterMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function xmlText(value: string) {
  return value
    .replace(/_x[0-9a-f]{4}_/gi, (match) => `_x005F_${match.slice(1)}`)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, (char) => `_x${char.charCodeAt(0).toString(16).padStart(4, "0")}_`)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function createMemberRosterWorkbook(entries: readonly MemberRosterEntry[]) {
  const collator = new Intl.Collator("ko", { numeric: true });
  const sorted = [...entries].sort((a, b) =>
    Number(!a.studentId) - Number(!b.studentId) ||
    collator.compare(a.studentId, b.studentId) || collator.compare(a.fullName, b.fullName)
  );
  const rows = [["학번", "이름"], ...sorted.map((entry) => [entry.studentId, entry.fullName])];
  // String cells preserve leading zeroes and never execute names/IDs as formulas.
  const sheetRows = rows.map((row, index) => `<row r="${index + 1}">${row.map((value, column) =>
    `<c r="${column === 0 ? "A" : "B"}${index + 1}" t="inlineStr" s="${index === 0 ? 1 : 0}"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`
  ).join("")}</row>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="회원 명부" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="32" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:B${rows.length}"/></worksheet>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
