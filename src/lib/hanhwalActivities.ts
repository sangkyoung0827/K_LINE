export type HanhwalActivityType =
  | "gathering"
  | "mt"
  | "special"
  | "opening"
  | "farewell"
  | "english-class";

export const hanhwalActivityTypes: HanhwalActivityType[] = [
  "gathering",
  "mt",
  "special",
  "opening",
  "farewell",
  "english-class"
];

export const hanhwalActivityTypeSet = new Set<HanhwalActivityType>(hanhwalActivityTypes);

export const hanhwalActivityTitles: Record<HanhwalActivityType, string> = {
  gathering: "Regular Archery Practice",
  mt: "Hanhwal Training Camp",
  special: "Traditional Archery Event",
  opening: "Semester Opening Practice",
  farewell: "Semester Closing Practice",
  "english-class": "Beginner Archery Class"
};

export type HanhwalActivityCounts = Record<HanhwalActivityType, number>;
export type HanhwalActivityStatuses = Record<HanhwalActivityType, boolean>;

export function normalizeHanhwalActivityType(value: string | null | undefined): HanhwalActivityType {
  const normalized = value?.trim().toLowerCase();
  return hanhwalActivityTypeSet.has(normalized as HanhwalActivityType)
    ? (normalized as HanhwalActivityType)
    : "gathering";
}

export function emptyHanhwalActivityCounts(): HanhwalActivityCounts {
  return {
    gathering: 0,
    mt: 0,
    special: 0,
    opening: 0,
    farewell: 0,
    "english-class": 0
  };
}

export function defaultHanhwalActivityStatuses(): HanhwalActivityStatuses {
  return {
    gathering: true,
    mt: true,
    special: true,
    opening: true,
    farewell: true,
    "english-class": true
  };
}
