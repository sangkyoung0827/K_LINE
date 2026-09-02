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
  activity_instance_id?: string | null;
  registration_closed_at?: string | null;
  requires_payment?: boolean | null;
};

const tableName = "hanhwal_activity_statuses";
const legacySelectedColumns = "activity_id,is_open,updated_at,updated_by";
const selectedColumns = `${legacySelectedColumns},activity_instance_id,registration_closed_at,requires_payment`;

export type HanhwalActivityCloseEvent = {
  activityId: HanhwalActivityType;
  activityInstanceId: string;
  registrationClosedAt: string;
};

async function listHanhwalActivityStatusRows() {
  try {
    return await supabaseRequest<HanhwalActivityStatusRow[]>(`${tableName}?select=${selectedColumns}`);
  } catch (error) {
    // History fields are additive. The established application controls must
    // keep working while a production database is waiting for its migration.
    if (error instanceof Error && "status" in error && error.status === 400) {
      return supabaseRequest<HanhwalActivityStatusRow[]>(
        `${tableName}?select=${legacySelectedColumns}`
      );
    }

    throw error;
  }
}

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
  const rows = await listHanhwalActivityStatusRows();
  const requiresPayment = Object.fromEntries(
    hanhwalActivityTypes.map((type) => [type, true])
  ) as Record<HanhwalActivityType, boolean>;
  const activityInstances = Object.fromEntries(
    hanhwalActivityTypes.map((type) => [type, ""])
  ) as Record<HanhwalActivityType, string>;

  rows.forEach((row) => {
    const type = normalizeHanhwalActivityType(row.activity_id);
    requiresPayment[type] = row.requires_payment !== false;
    activityInstances[type] = row.activity_instance_id ?? "";
  });

  return {
    statuses: mergeHanhwalActivityStatuses(rows),
    requiresPayment,
    activityInstances,
    tableReady: true
  };
}

export async function updateHanhwalActivityStatuses(
  updates: Partial<Record<HanhwalActivityType, boolean>>,
  updatedBy: string,
  paymentRequirements: Partial<Record<HanhwalActivityType, boolean>> = {}
) {
  const currentRows = await listHanhwalActivityStatusRows();
  const currentByType = new Map(
    currentRows.map((row) => [normalizeHanhwalActivityType(row.activity_id), row])
  );
  const now = new Date().toISOString();
  const closedActivities: HanhwalActivityCloseEvent[] = [];
  const rows = hanhwalActivityTypes
    .filter(
      (type) =>
        typeof updates[type] === "boolean" || typeof paymentRequirements[type] === "boolean"
    )
    .map((type) => {
      const current = currentByType.get(type);
      const wasOpen = current?.is_open !== false;
      const isOpen = updates[type] ?? wasOpen;
      const activityInstanceId = current?.activity_instance_id || crypto.randomUUID();

      if (wasOpen && !isOpen && current?.activity_instance_id) {
        closedActivities.push({
          activityId: type,
          activityInstanceId: current.activity_instance_id,
          registrationClosedAt: now
        });
      }

      return {
        activity_id: type,
        activity_instance_id: isOpen && !wasOpen ? crypto.randomUUID() : activityInstanceId,
        is_open: isOpen,
        registration_closed_at: isOpen
          ? null
          : wasOpen
            ? now
            : current?.registration_closed_at ?? null,
        requires_payment: paymentRequirements[type] ?? current?.requires_payment ?? true,
        updated_at: now,
        updated_by: updatedBy
      };
    });

  if (rows.length > 0) {
    try {
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
    } catch (error) {
      if (!(error instanceof Error && "status" in error && error.status === 400)) {
        throw error;
      }

      await supabaseRequest<HanhwalActivityStatusRow[]>(
        `${tableName}?on_conflict=activity_id&select=${legacySelectedColumns}`,
        {
          method: "POST",
          headers: {
            Prefer: "resolution=merge-duplicates,return=representation"
          },
          body: JSON.stringify(
            rows.map(({ activity_id, is_open, updated_at, updated_by }) => ({
              activity_id,
              is_open,
              updated_at,
              updated_by
            }))
          )
        }
      );
      closedActivities.length = 0;
    }
  }

  return { ...(await getHanhwalActivityStatuses()), closedActivities };
}
