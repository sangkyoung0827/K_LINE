export type MyHistoryRecord = {
  id: string;
  source: "ecc" | "hanhwal" | "social_impact_union";
  activityTitle: string;
  closedAt: string | null;
  rating: number | null;
};

export type MyHistoryResponse = {
  ownerEmail: string;
  records: MyHistoryRecord[];
  nextCursor: string | null;
};

export function historyDate(value: string | null, language: "ko" | "en") {
  if (!value || !Number.isFinite(Date.parse(value))) return language === "ko" ? "날짜 미상" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-GB", {
    timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric"
  }).format(new Date(value));
}

export function appendHistory(current: MyHistoryRecord[], incoming: MyHistoryRecord[]) {
  const ids = new Set(current.map((record) => record.id));
  return [...current, ...incoming.filter((record) => {
    if (ids.has(record.id)) return false;
    ids.add(record.id);
    return true;
  })];
}
