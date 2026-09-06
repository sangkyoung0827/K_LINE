import "server-only";

import { updateEccActivityStatuses } from "@/lib/eccActivityStatuses";
import { getEccActivityCatalog } from "@/lib/eccOperations";
import {
  createActivityRecordsForClosedActivities,
  markActivityApplicationsClosed
} from "@/lib/userActivityRecords";

export async function applyEccActivityStatusAdminUpdate(input: {
  adminEmail: string;
  updates: Record<string, boolean>;
  paymentRequirements?: Record<string, boolean>;
}) {
  const catalog = await getEccActivityCatalog({ includeArchived: true });
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

  const result = await updateEccActivityStatuses(
    updates,
    input.adminEmail,
    paymentRequirements
  );

  if (result.closedActivities.length > 0) {
    try {
      await markActivityApplicationsClosed("ecc", result.closedActivities);
      await createActivityRecordsForClosedActivities(
        "ecc",
        result.closedActivities
      );
    } catch (error) {
      console.error("ECC user activity close sync failed", error);
    }
  }

  return result;
}
