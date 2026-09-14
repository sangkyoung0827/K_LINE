import {
  type HanhwalCompetitionConfig,
  type HanhwalCompetitionDivision,
  type HanhwalEquipmentConfig,
  type HanhwalEquipmentItemType,
  type HanhwalStructuredActivity,
  type HanhwalStructuredConfiguration,
  type HanhwalStructuredKind,
  type HanhwalStructuredPayload,
  type HanhwalStructuredStatus,
  type HanhwalUniformConfig,
  isHanhwalStructuredKind
} from "@/lib/hanhwalStructuredTypes";

export class HanhwalStructuredError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems = 30) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];
  return [...new Set(source.map((item) => text(item, 100)).filter(Boolean))].slice(0, maxItems);
}

function optionalMoney(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000_000) {
    throw new HanhwalStructuredError("INVALID_AMOUNT", 400, "Amount must be a non-negative whole number.");
  }
  return number;
}

function optionalPositiveInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100_000) {
    throw new HanhwalStructuredError("INVALID_QUANTITY_RULE", 400, "Order unit or capacity must be a positive whole number.");
  }
  return number;
}

function isoDate(value: unknown, required: boolean) {
  const raw = text(value, 80);
  if (!raw && !required) return "";
  if (!raw || !Number.isFinite(Date.parse(raw))) {
    throw new HanhwalStructuredError("INVALID_DATE", 400, "A valid date and time is required.");
  }
  return new Date(raw).toISOString();
}

function optionId(value: unknown, fallback: string) {
  const normalized = text(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return normalized || fallback;
}

function competitionConfig(value: unknown): HanhwalCompetitionConfig {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const divisions = Array.isArray(input.divisions) ? input.divisions : [];
  const used = new Set<string>();
  const cleaned = divisions.slice(0, 30).map((entry, index) => {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const label = text(row.label, 120);
    if (!label) {
      throw new HanhwalStructuredError("INVALID_DIVISION", 400, "Every competition division needs a label.");
    }
    const base = optionId(row.id || label, `division-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return {
      id,
      label,
      description: text(row.description, 500),
      capacity: optionalPositiveInteger(row.capacity)
    } satisfies HanhwalCompetitionDivision;
  });
  return { divisions: cleaned };
}

const equipmentItemTypes = new Set(["bow", "arrow", "bow_and_arrow", "other"]);

function equipmentConfig(value: unknown): HanhwalEquipmentConfig {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const itemType = text(input.itemType, 40) || "arrow";
  if (!equipmentItemTypes.has(itemType)) {
    throw new HanhwalStructuredError("INVALID_ITEM_TYPE", 400, "Select a supported equipment item type.");
  }
  return {
    itemType: itemType as HanhwalEquipmentItemType,
    minimumOrderUnit: optionalPositiveInteger(input.minimumOrderUnit),
    availableOptions: stringList(input.availableOptions),
    featherColors: stringList(input.featherColors),
    lengths: stringList(input.lengths),
    weights: stringList(input.weights)
  };
}

function uniformConfig(value: unknown): HanhwalUniformConfig {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    sizes: stringList(input.sizes),
    variants: stringList(input.variants)
  };
}

function cleanConfiguration(kind: HanhwalStructuredKind, value: unknown): HanhwalStructuredConfiguration {
  if (kind === "competition") return competitionConfig(value);
  if (kind === "equipment_order") return equipmentConfig(value);
  return uniformConfig(value);
}

export function cleanHanhwalStructuredActivityInput(
  input: Record<string, unknown>,
  existing?: HanhwalStructuredActivity
): Omit<HanhwalStructuredActivity, "createdAt" | "id" | "updatedAt"> {
  const kindValue = input.kind ?? existing?.kind;
  if (!isHanhwalStructuredKind(kindValue)) {
    throw new HanhwalStructuredError("INVALID_KIND", 400, "Select a supported Hanhwal application type.");
  }
  const kind = kindValue;
  if (existing && kind !== existing.kind) {
    throw new HanhwalStructuredError("KIND_IMMUTABLE", 409, "An existing application round cannot change type.");
  }
  const title = text(input.title ?? existing?.title, 180);
  const deadline = isoDate(input.deadline ?? existing?.deadline, true);
  const statusValue = text(input.status ?? existing?.status, 20) || "draft";
  if (!new Set<HanhwalStructuredStatus>(["draft", "open", "closed"]).has(statusValue as HanhwalStructuredStatus)) {
    throw new HanhwalStructuredError("INVALID_STATUS", 400, "Select draft, open, or closed.");
  }
  const status = statusValue as HanhwalStructuredStatus;
  const configuration = cleanConfiguration(kind, input.configuration ?? existing?.configuration);

  if (!title) {
    throw new HanhwalStructuredError("TITLE_REQUIRED", 400, "A title is required.");
  }
  if (status === "open" && Date.parse(deadline) <= Date.now()) {
    throw new HanhwalStructuredError("DEADLINE_PASSED", 409, "An open application must have a future deadline.");
  }
  if (status === "open" && kind === "competition" && (configuration as HanhwalCompetitionConfig).divisions.length === 0) {
    throw new HanhwalStructuredError("DIVISIONS_REQUIRED", 400, "Add at least one competition division before opening.");
  }
  if (status === "open" && kind === "competition" && (!input.eventDate && !existing?.eventDate)) {
    throw new HanhwalStructuredError("EVENT_DATE_REQUIRED", 400, "Add the competition date before opening.");
  }
  if (status === "open" && kind === "competition" && !text(input.location ?? existing?.location, 300)) {
    throw new HanhwalStructuredError("LOCATION_REQUIRED", 400, "Add the competition location before opening.");
  }
  if (status === "open" && kind === "uniform_order" && (configuration as HanhwalUniformConfig).sizes.length === 0) {
    throw new HanhwalStructuredError("SIZES_REQUIRED", 400, "Add at least one size before opening.");
  }
  if (status === "open" && kind !== "competition" && !text(input.itemName ?? existing?.itemName, 180)) {
    throw new HanhwalStructuredError("ITEM_NAME_REQUIRED", 400, "Add the item name before opening an order.");
  }

  return {
    kind,
    title,
    description: text(input.description ?? existing?.description, 3000),
    eventDate: isoDate(input.eventDate ?? existing?.eventDate, false),
    location: text(input.location ?? existing?.location, 300),
    deadline,
    feeKrw: optionalMoney(input.feeKrw ?? existing?.feeKrw),
    unitPriceKrw: optionalMoney(input.unitPriceKrw ?? existing?.unitPriceKrw),
    pricingNote: text(input.pricingNote ?? existing?.pricingNote, 1000),
    itemName: text(input.itemName ?? existing?.itemName, 180),
    pickupInformation: text(input.pickupInformation ?? existing?.pickupInformation, 1000),
    notes: text(input.notes ?? existing?.notes, 2000),
    status,
    configuration
  };
}

function requireConfigured(value: unknown, options: string[], code: string, message: string) {
  const cleaned = text(value, 100);
  if (!cleaned || (options.length > 0 && !options.includes(cleaned))) {
    throw new HanhwalStructuredError(code, 400, message);
  }
  return cleaned;
}

function optionalConfigured(value: unknown, options: string[], code: string) {
  const cleaned = text(value, 100);
  if (cleaned && options.length > 0 && !options.includes(cleaned)) {
    throw new HanhwalStructuredError(code, 400, "The selected option is not available in this order round.");
  }
  return cleaned;
}

export function cleanHanhwalStructuredSubmissionPayload(
  activity: HanhwalStructuredActivity,
  input: Record<string, unknown>
): HanhwalStructuredPayload {
  if (activity.kind === "competition") {
    const config = activity.configuration as HanhwalCompetitionConfig;
    const divisionId = text(input.divisionId, 80);
    if (!config.divisions.some((division) => division.id === divisionId)) {
      throw new HanhwalStructuredError("INVALID_DIVISION", 400, "Select an available competition division.");
    }
    return { divisionId, note: text(input.note, 1000) };
  }

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
    throw new HanhwalStructuredError("INVALID_QUANTITY", 400, "Quantity must be a positive whole number.");
  }

  if (activity.kind === "equipment_order") {
    const config = activity.configuration as HanhwalEquipmentConfig;
    if (config.minimumOrderUnit && quantity % config.minimumOrderUnit !== 0) {
      throw new HanhwalStructuredError(
        "INVALID_ORDER_UNIT",
        400,
        `Quantity must be ordered in units of ${config.minimumOrderUnit}.`
      );
    }
    return {
      quantity,
      printText: text(input.printText, 120),
      featherColor1: optionalConfigured(input.featherColor1, config.featherColors, "INVALID_FEATHER_COLOR"),
      featherColor2: optionalConfigured(input.featherColor2, config.featherColors, "INVALID_FEATHER_COLOR"),
      length: optionalConfigured(input.length, config.lengths, "INVALID_LENGTH"),
      weight: optionalConfigured(input.weight, config.weights, "INVALID_WEIGHT"),
      option: config.availableOptions.length
        ? requireConfigured(input.option, config.availableOptions, "INVALID_EQUIPMENT_OPTION", "Select an available equipment option.")
        : text(input.option, 100),
      note: text(input.note, 1000)
    };
  }

  const config = activity.configuration as HanhwalUniformConfig;
  return {
    quantity,
    size: requireConfigured(input.size, config.sizes, "INVALID_SIZE", "Select an available size."),
    variant: config.variants.length
      ? requireConfigured(input.variant, config.variants, "INVALID_VARIANT", "Select an available variant.")
      : "",
    note: text(input.note, 1000)
  };
}
