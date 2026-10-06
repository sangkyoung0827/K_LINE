export type GoogleApplicant = { id: string; answers_json: Record<string, string[]>; respondent_email: string | null };

export function applicantNames(rows: GoogleApplicant[]) {
  return rows.map((row) => Object.entries(row.answers_json).find(([title]) => /(?:\bname\b|이름)/i.test(title))?.[1]?.[0]?.trim() || "이름 미입력");
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

export function googleTeamNotice(title: string, rows: GoogleApplicant[], teamSize: number) {
  const groups = groupGoogleApplicants(rows, teamSize);
  if (!groups.length) return "";
  return [
    `${title} — 조 편성 안내 / Team Assignments`,
    "",
    ...groups.map((group, index) => `${index + 1}조 / Team ${index + 1}: ${group.join(", ")}`),
  ].join("\n");
}
