import { applicationPreferenceEvent } from "./applications";
import type { ActivityMapping, ApplicationSignalRow } from "../types";
export const eccPreferenceAdapter = {
  source: "ecc", table: "ecc_activity_applications",
  columns: "id,user_id,activity_id,activity_instance_id,created_at",
  toEvent: (row: ApplicationSignalRow, mapping: ActivityMapping | null) => applicationPreferenceEvent("ecc", row, mapping)
};
