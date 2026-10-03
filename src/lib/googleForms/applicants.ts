export type GoogleApplicant = { id: string; answers_json: Record<string, string[]>; respondent_email: string | null };

export function applicantNames(rows: GoogleApplicant[]) {
  return rows.map((row) => Object.entries(row.answers_json).find(([title]) => /(?:\bname\b|이름)/i.test(title))?.[1]?.[0] || row.respondent_email || row.id);
}

export function groupGoogleApplicants(rows: GoogleApplicant[], teamSize: number) {
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 50) throw new Error("INVALID_TEAM_SIZE");
  if (!rows.length) return [];
  // Match the native ECC snake allocation; keep the test roster source separate.
  const count = Math.ceil(rows.length / teamSize);
  const groups: string[][] = Array.from({ length: count }, () => []);
  const names = applicantNames(rows).sort((a, b) => a.localeCompare(b));
  names.forEach((name, index) => {
    const cycle = index % (count * 2);
    groups[cycle < count ? cycle : count * 2 - cycle - 1].push(name);
  });
  return groups;
}
