import "server-only";

import {
  defaultHanhwalActivityStatuses,
  hanhwalActivityTypes,
  normalizeHanhwalActivityType,
  type HanhwalActivityStatuses,
  type HanhwalActivityType
} from "@/lib/hanhwalActivities";
import { supabaseRequest } from "@/lib/supabaseServer";

type HanhwalActivityStatusRow = {
  activity_id: string;
  is_open: boolean | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const tableName = "hanhwal_activity_statuses";
const selectedColumns = "activity_id,is_open,updated_at,updated_by";

export function mergeHanhwalActivityStatuses(
  rows: HanhwalActivityStatusRow[] = []
): HanhwalActivityStatuses {
  const statuses = defaultHanhwalActivityStatuses();

  rows.forEach((row) => {
    const type = normalizeHanhwalActivityType(row.activity_id);
    statuses[type] = row.is_open !== false;
  });

  return statuses;
}

export async function getHanhwalActivityStatuses() {
  const rows = await supabaseRequest<HanhwalActivityStatusRow[]>(
    `${tableName}?select=${selectedColumns}`
  );

  return {
    statuses: mergeHanhwalActivityStatuses(rows),
    tableReady: true
  };
}

export async function updateHanhwalActivityStatuses(
  updates: Partial<Record<HanhwalActivityType, boolean>>,
  updatedBy: string
) {
  const rows = hanhwalActivityTypes
    .filter((type) => typeof updates[type] === "boolean")
    .map((type) => ({
      activity_id: type,
      is_open: Boolean(updates[type]),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    }));

  if (rows.length > 0) {
    await supabaseRequest<HanhwalActivityStatusRow[]>(
      `${tableName}?on_conflict=activity_id&select=${selectedColumns}`,
      {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(rows)
      }
    );
  }

  return getHanhwalActivityStatuses();
}
