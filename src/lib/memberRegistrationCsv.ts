import "server-only";

import { cleanText } from "@/lib/supabaseServer";

type ParsedCsvRow = {
  externalRowId: string;
  applicantName: string;
  applicantEmail: string;
};

const nameHeaders = ["name", "이름", "성명", "applicant", "full name"];
const emailHeaders = ["email", "e-mail", "이메일", "메일"];
const kakaoHeaders = ["kakao", "kakaotalk", "카카오", "카카오톡"];

export function parseMemberRegistrationCsv(csvText: string): ParsedCsvRow[] {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((cell) => normalizeHeader(cell));
  const hasHeader = header.some((cell) =>
    [...nameHeaders, ...emailHeaders, ...kakaoHeaders].some((keyword) => cell.includes(keyword))
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const nameIndex = findHeaderIndex(header, nameHeaders);
  const emailIndex = findHeaderIndex(header, emailHeaders);
  const kakaoIndex = findHeaderIndex(header, kakaoHeaders);

  return dataRows
    .map((row, index) => {
      const fallbackName = row.find((cell) => cleanText(cell, 240)) ?? "";
      const name =
        cellAt(row, nameIndex) || cellAt(row, kakaoIndex) || (hasHeader ? fallbackName : cellAt(row, 0));
      const email = cellAt(row, emailIndex) || (hasHeader ? "" : cellAt(row, 1));

      return {
        externalRowId: `csv-row-${index + 1}`,
        applicantName: cleanText(name, 240),
        applicantEmail: cleanText(email, 240)
      };
    })
    .filter((row) => row.applicantName || row.applicantEmail);
}

export function toMemberRegistrationCsv(
  rows: Array<{
    createdAt: string;
    applicantName: string;
    applicantEmail: string;
    status: string;
    kakaoJoined: boolean;
    memo: string;
  }>
) {
  const header = ["created_at", "name", "email", "status", "kakao_joined", "memo"];
  const body = rows.map((row) => [
    row.createdAt,
    row.applicantName,
    row.applicantEmail,
    row.status,
    row.kakaoJoined ? "yes" : "no",
    row.memo
  ]);

  return [header, ...body].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function findHeaderIndex(header: string[], keywords: string[]) {
  return header.findIndex((cell) => keywords.some((keyword) => cell.includes(keyword)));
}

function cellAt(row: string[], index: number) {
  return index >= 0 ? row[index] ?? "" : "";
}

function escapeCsvCell(value: string) {
  const text = value.replace(/\r?\n/g, " ");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
