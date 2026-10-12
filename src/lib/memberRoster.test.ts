import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { readSheet as readXlsxFile } from "read-excel-file/node";
import { createMemberRosterWorkbook } from "./memberRoster";

test("xlsx has only student ID and name, ordered without mutating membership data", async () => {
  const entries = [
    { studentId: "20260002", fullName: "Zoe", paymentConfirmed: false, officialMember: false, email: "private@example.test" },
    { studentId: "001234", fullName: "김하늘", paymentConfirmed: true, officialMember: true, email: "private2@example.test" },
    { studentId: "20260002", fullName: "Anna", paymentConfirmed: true, officialMember: true, email: "private3@example.test" },
    { studentId: "", fullName: "No ID", paymentConfirmed: false, officialMember: false, email: "private4@example.test" }
  ];
  const before = JSON.stringify(entries);
  const bytes = await createMemberRosterWorkbook(entries);
  assert.deepEqual(await readXlsxFile(Buffer.from(bytes)), [["학번", "이름"], ["001234", "김하늘"], ["20260002", "Anna"], ["20260002", "Zoe"], [null, "No ID"]]);
  assert.equal(JSON.stringify(entries), before);
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.doesNotMatch(sheet, /private@example|paymentConfirmed|officialMember|<f[ >]/);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /autoFilter ref="A1:B5"/);
});

test("IDs and names are literal text: formula-like strings, XML, Korean, spaces and escape-looking text", async () => {
  const entries = [
    { studentId: "0009", fullName: '=HYPERLINK("https://example.test")' },
    { studentId: "0010", fullName: "  이름 <한글> & 친구  " },
    { studentId: "0011", fullName: "+123" },
    { studentId: "0012", fullName: "_x0041_" },
    { studentId: "0013", fullName: "@SUM(A1)" },
    { studentId: "0014", fullName: "-1" }
  ];
  const bytes = await createMemberRosterWorkbook(entries);
  // The reader does not decode SpreadsheetML escape sequences; Excel does.
  assert.deepEqual(await readXlsxFile(Buffer.from(bytes), { trim: false }), [["학번", "이름"], ...entries.map((entry) => [entry.studentId, entry.fullName === "_x0041_" ? "_x005F_x0041_" : entry.fullName])]);
  const zip = await JSZip.loadAsync(bytes);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.match(sheet, /_x005F_x0041_/);
});

test("empty roster is a valid header-only workbook", async () => {
  assert.deepEqual(await readXlsxFile(Buffer.from(await createMemberRosterWorkbook([]))), [["학번", "이름"]]);
});
