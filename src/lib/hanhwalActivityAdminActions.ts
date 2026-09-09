import "server-only";

import { updateHanhwalActivityStatuses } from "@/lib/hanhwalActivityStatuses";
import { getHanhwalActivityCatalog } from "@/lib/hanhwalOperations";
import {
  createActivityRecordsForClosedActivities,
  markActivityApplicationsClosed
} from "@/lib/userActivityRecords";

export async function applyHanhwalActivityStatusAdminUpdate(input: {
  adminEmail: string;
  updates: Record<string, boolean>;
  paymentRequirements?: Record<string, boolean>;
}) {
  const catalog = await getHanhwalActivityCatalog({ includeArchived: true });
  const activeIds = new Set(
    catalog.filter((item) => !item.archived).map((item) => item.id)
  );
  const updates = Object.fromEntries(
    Object.entries(input.updates).filter(
      ([id, value]) => activeIds.has(id) && typeof value === "boolean"
    )
  );
  const paymentRequirements = Object.fromEntries(
    Object.entries(input.paymentRequirements ?? {}).filter(
      ([id, value]) => activeIds.has(id) && typeof value === "boolean"
    )
  );

  const openedActivity = Object.keys(updates).find(
    (id) => updates[id] === true
  );

  if (openedActivity) {
    catalog
      .filter((item) => !item.archived)
      .forEach((item) => {
        updates[item.id] = item.id === openedActivity;
      });
  }

  const result = await updateHanhwalActivityStatuses(
    updates,
    input.adminEmail,
    paymentRequirements
  );

  if (result.closedActivities.length > 0) {
    try {
      await markActivityApplicationsClosed("hanhwal", result.closedActivities);
      await createActivityRecordsForClosedActivities(
        "hanhwal",
        result.closedActivities
      );
    } catch (error) {
      console.error("HANHWAL user activity close sync failed", error);
    }
  }

  return result;
}
