export type EccActivityType =
  | "gathering"
  | "mt"
  | "special"
  | "opening"
  | "farewell"
  | "english-class";

export const eccActivityTypes: EccActivityType[] = [
  "gathering",
  "mt",
  "special",
  "opening",
  "farewell",
  "english-class"
];

export const eccActivityTypeSet = new Set<EccActivityType>(eccActivityTypes);

export const eccActivityTitles: Record<EccActivityType, string> = {
  gathering: "International Gathering",
  mt: "MT",
  special: "Special Event",
  opening: "Semester Opening Party",
  farewell: "Farewell Party",
  "english-class": "English Class"
};

export type EccActivityCounts = Record<EccActivityType, number>;
export type EccActivityStatuses = Record<EccActivityType, boolean>;

export function normalizeEccActivityType(value: string | null | undefined): EccActivityType {
  const normalized = value?.trim().toLowerCase();
  return eccActivityTypeSet.has(normalized as EccActivityType)
    ? (normalized as EccActivityType)
    : "gathering";
}

export function emptyEccActivityCounts(): EccActivityCounts {
  return {
    gathering: 0,
    mt: 0,
    special: 0,
    opening: 0,
    farewell: 0,
    "english-class": 0
  };
}

export function defaultEccActivityStatuses(): EccActivityStatuses {
  return {
    gathering: true,
    mt: true,
    special: true,
    opening: true,
    farewell: true,
    "english-class": true
  };
}
