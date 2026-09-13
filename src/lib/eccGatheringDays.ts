export const eccGatheringDays = ["monday", "wednesday"] as const;
export type EccGatheringDay = (typeof eccGatheringDays)[number];

export const eccGatheringDayLabels = {
  monday: { ko: "월요일", en: "Monday" },
  wednesday: { ko: "수요일", en: "Wednesday" }
} as const;

export function parseEccGatheringDays(value: unknown): EccGatheringDay[] | null {
  if (!Array.isArray(value) || value.length > 2 ||
      value.some((day) => !eccGatheringDays.includes(day)) ||
      new Set(value).size !== value.length) return null;
  return eccGatheringDays.filter((day) => value.includes(day));
}

export function validEccGatheringSelection(selected: unknown, open: EccGatheringDay[]) {
  const days = parseEccGatheringDays(selected);
  return days !== null && days.length > 0 && days.every((day) => open.includes(day));
}
