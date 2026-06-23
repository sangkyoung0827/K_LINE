import "server-only";

import {
  defaultEccActivityStatuses,
  eccActivityTypes,
  normalizeEccActivityType,
  type EccActivityStatuses,
  type EccActivityType
} from "@/lib/eccActivities";
import { supabaseRequest } from "@/lib/supabaseServer";

type EccActivityStatusRow = {
  activity_id: string;
  is_open: boolean | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

const tableName = "ecc_activity_statuses";
const selectedColumns = "activity_id,is_open,updated_at,updated_by";

export function mergeEccActivityStatuses(
  rows: EccActivityStatusRow[] = []
): EccActivityStatuses {
  const statuses = defaultEccActivityStatuses();

  rows.forEach((row) => {
    const type = normalizeEccActivityType(row.activity_id);
    statuses[type] = row.is_open !== false;
  });

  return statuses;
}

export async function getEccActivityStatuses() {
  const rows = await supabaseRequest<EccActivityStatusRow[]>(
    `${tableName}?select=${selectedColumns}`
  );

  return {
    statuses: mergeEccActivityStatuses(rows),
    tableReady: true
  };
}

export async function updateEccActivityStatuses(
  updates: Partial<Record<EccActivityType, boolean>>,
  updatedBy: string
) {
  const rows = eccActivityTypes
    .filter((type) => typeof updates[type] === "boolean")
    .map((type) => ({
      activity_id: type,
      is_open: Boolean(updates[type]),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy
    }));

  if (rows.length > 0) {
    await supabaseRequest<EccActivityStatusRow[]>(
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

  return getEccActivityStatuses();
}
