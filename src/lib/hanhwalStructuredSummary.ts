import type {
  HanhwalCompetitionConfig,
  HanhwalEquipmentConfig,
  HanhwalStructuredActivity,
  HanhwalStructuredSubmission,
  HanhwalStructuredSummary,
  HanhwalUniformConfig
} from "./hanhwalStructuredTypes";

export function summarizeHanhwalStructuredActivity(
  activity: HanhwalStructuredActivity,
  submissions: HanhwalStructuredSubmission[]
): HanhwalStructuredSummary {
  const active = submissions.filter((row) => row.activityId === activity.id && row.status === "submitted");
  const quantityOf = (row: HanhwalStructuredSubmission) => Number((row.payload as { quantity?: number }).quantity || 1);
  const totalQuantity = active.reduce((total, row) => total + quantityOf(row), 0);
  const breakdown: HanhwalStructuredSummary["breakdown"] = [];

  if (activity.kind === "competition") {
    for (const division of (activity.configuration as HanhwalCompetitionConfig).divisions) {
      breakdown.push({
        id: division.id,
        label: division.label,
        capacity: division.capacity,
        count: active.filter((row) => (row.payload as { divisionId?: string }).divisionId === division.id).length
      });
    }
  } else if (activity.kind === "equipment_order") {
    for (const option of (activity.configuration as HanhwalEquipmentConfig).availableOptions) {
      breakdown.push({
        id: `option:${option}`,
        label: option,
        count: active.filter((row) => (row.payload as { option?: string }).option === option)
          .reduce((total, row) => total + quantityOf(row), 0)
      });
    }
  } else {
    const config = activity.configuration as HanhwalUniformConfig;
    for (const size of config.sizes) {
      breakdown.push({
        id: `size:${size}`,
        label: `Size ${size}`,
        count: active.filter((row) => (row.payload as { size?: string }).size === size)
          .reduce((total, row) => total + quantityOf(row), 0)
      });
    }
    for (const variant of config.variants) {
      breakdown.push({
        id: `variant:${variant}`,
        label: variant,
        count: active.filter((row) => (row.payload as { variant?: string }).variant === variant)
          .reduce((total, row) => total + quantityOf(row), 0)
      });
    }
  }

  return {
    submissionCount: active.length,
    totalQuantity,
    estimatedTotalKrw: activity.unitPriceKrw === null ? null : activity.unitPriceKrw * totalQuantity,
    breakdown
  };
}
