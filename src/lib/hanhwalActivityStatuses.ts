import "server-only";

import {
  hanhwalActivityTypeSet,
  normalizeHanhwalActivityId,
  type HanhwalActivityType
} from "@/lib/hanhwalActivities";
import { getHanhwalActivityCatalog } from "@/lib/hanhwalOperations";
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
const selectedColumns =
  `${legacySelectedColumns},activity_instance_id,registration_closed_at,requires_payment`;

export type HanhwalActivityCloseEvent = {
  activityId: string;
  activityInstanceId: string;
  registrationClosedAt: string;
};

async function listHanhwalActivityStatusRows() {
  try {
    return await supabaseRequest<HanhwalActivityStatusRow[]>(
      `${tableName}?select=${selectedColumns}`
    );
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 400) {
      return supabaseRequest<HanhwalActivityStatusRow[]>(
        `${tableName}?select=${legacySelectedColumns}`
      );
    }

    throw error;
  }
}

function legacyDefaultOpen(activityId: string) {
  return hanhwalActivityTypeSet.has(activityId as HanhwalActivityType);
}

export async function getHanhwalActivityStatuses() {
  const [rows, catalog] = await Promise.all([
    listHanhwalActivityStatusRows(),
    getHanhwalActivityCatalog({ includeArchived: true })
  ]);

  const activityIds = Array.from(
    new Set([
      ...catalog.map((item) => item.id),
      ...rows.map((row) => normalizeHanhwalActivityId(row.activity_id))
    ])
  );

  const statuses: Record<string, boolean> = {};
  const requiresPayment: Record<string, boolean> = {};
  const activityInstances: Record<string, string> = {};

  activityIds.forEach((activityId) => {
    statuses[activityId] = legacyDefaultOpen(activityId);
    requiresPayment[activityId] = true;
    activityInstances[activityId] = "";
  });

  rows.forEach((row) => {
    const activityId = normalizeHanhwalActivityId(row.activity_id);
    statuses[activityId] = row.is_open !== false;
    requiresPayment[activityId] = row.requires_payment !== false;
    activityInstances[activityId] = row.activity_instance_id ?? "";
  });

  return {
    statuses,
    requiresPayment,
    activityInstances,
    tableReady: true
  };
}

export async function updateHanhwalActivityStatuses(
  updates: Record<string, boolean>,
  updatedBy: string,
  paymentRequirements: Record<string, boolean> = {}
) {
  const currentRows = await listHanhwalActivityStatusRows();
  const currentById = new Map(
    currentRows.map((row) => [normalizeHanhwalActivityId(row.activity_id), row])
  );
  const now = new Date().toISOString();
  const closedActivities: HanhwalActivityCloseEvent[] = [];
  const activityIds = Array.from(
    new Set([
      ...Object.keys(updates).map(normalizeHanhwalActivityId),
      ...Object.keys(paymentRequirements).map(normalizeHanhwalActivityId)
    ])
  );

  const rows = activityIds.map((activityId) => {
    const current = currentById.get(activityId);
    const wasOpen = current ? current.is_open !== false : legacyDefaultOpen(activityId);
    const isOpen = updates[activityId] ?? wasOpen;
    const existingInstanceId = current?.activity_instance_id || "";
    const activityInstanceId =
      isOpen && !wasOpen
        ? crypto.randomUUID()
        : existingInstanceId || (isOpen ? crypto.randomUUID() : "");

    if (wasOpen && !isOpen && existingInstanceId) {
      closedActivities.push({
        activityId,
        activityInstanceId: existingInstanceId,
        registrationClosedAt: now
      });
    }

    return {
      activity_id: activityId,
      activity_instance_id: activityInstanceId || null,
      is_open: isOpen,
      registration_closed_at: isOpen
        ? null
        : wasOpen
          ? now
          : current?.registration_closed_at ?? null,
      requires_payment:
        paymentRequirements[activityId] ?? current?.requires_payment ?? true,
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
