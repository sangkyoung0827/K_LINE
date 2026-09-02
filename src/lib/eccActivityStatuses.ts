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
  activity_instance_id?: string | null;
  registration_closed_at?: string | null;
  requires_payment?: boolean | null;
};

const tableName = "ecc_activity_statuses";
const legacySelectedColumns = "activity_id,is_open,updated_at,updated_by";
const selectedColumns = `${legacySelectedColumns},activity_instance_id,registration_closed_at,requires_payment`;

export type EccActivityCloseEvent = {
  activityId: EccActivityType;
  activityInstanceId: string;
  registrationClosedAt: string;
};

async function listEccActivityStatusRows() {
  try {
    return await supabaseRequest<EccActivityStatusRow[]>(`${tableName}?select=${selectedColumns}`);
  } catch (error) {
    // Keep the existing open/close controls working until the additive history
    // migration has been applied to the production database.
    if (error instanceof Error && "status" in error && error.status === 400) {
      return supabaseRequest<EccActivityStatusRow[]>(
        `${tableName}?select=${legacySelectedColumns}`
      );
    }

    throw error;
  }
}

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
  const rows = await listEccActivityStatusRows();
  const requiresPayment = Object.fromEntries(
    eccActivityTypes.map((type) => [type, true])
  ) as Record<EccActivityType, boolean>;
  const activityInstances = Object.fromEntries(
    eccActivityTypes.map((type) => [type, ""])
  ) as Record<EccActivityType, string>;

  rows.forEach((row) => {
    const type = normalizeEccActivityType(row.activity_id);
    requiresPayment[type] = row.requires_payment !== false;
    activityInstances[type] = row.activity_instance_id ?? "";
  });

  return {
    statuses: mergeEccActivityStatuses(rows),
    requiresPayment,
    activityInstances,
    tableReady: true
  };
}

export async function updateEccActivityStatuses(
  updates: Partial<Record<EccActivityType, boolean>>,
  updatedBy: string,
  paymentRequirements: Partial<Record<EccActivityType, boolean>> = {}
) {
  const currentRows = await listEccActivityStatusRows();
  const currentByType = new Map(
    currentRows.map((row) => [normalizeEccActivityType(row.activity_id), row])
  );
  const now = new Date().toISOString();
  const closedActivities: EccActivityCloseEvent[] = [];
  const rows = eccActivityTypes
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
    } catch (error) {
      if (!(error instanceof Error && "status" in error && error.status === 400)) {
        throw error;
      }

      await supabaseRequest<EccActivityStatusRow[]>(
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

  return { ...(await getEccActivityStatuses()), closedActivities };
}
