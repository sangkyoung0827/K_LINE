export const hanhwalStructuredKinds = [
  "competition",
  "equipment_order",
  "uniform_order"
] as const;

export type HanhwalStructuredKind = (typeof hanhwalStructuredKinds)[number];
export type HanhwalStructuredStatus = "draft" | "open" | "closed";
export type HanhwalPaymentStatus = "unconfirmed" | "confirmed";
export type HanhwalFulfillmentStatus = "ordered" | "ready" | "received";
export type HanhwalEquipmentItemType = "bow" | "arrow" | "bow_and_arrow" | "other";

export type HanhwalCompetitionDivision = {
  capacity: number | null;
  description: string;
  id: string;
  label: string;
};

export type HanhwalCompetitionConfig = {
  divisions: HanhwalCompetitionDivision[];
};

export type HanhwalEquipmentConfig = {
  availableOptions: string[];
  featherColors: string[];
  itemType: HanhwalEquipmentItemType;
  lengths: string[];
  minimumOrderUnit: number | null;
  weights: string[];
};

export type HanhwalUniformConfig = {
  sizes: string[];
  variants: string[];
};

export type HanhwalStructuredConfiguration =
  | HanhwalCompetitionConfig
  | HanhwalEquipmentConfig
  | HanhwalUniformConfig;

export type HanhwalStructuredActivity = {
  configuration: HanhwalStructuredConfiguration;
  createdAt: string;
  deadline: string;
  description: string;
  eventDate: string;
  feeKrw: number | null;
  id: string;
  itemName: string;
  kind: HanhwalStructuredKind;
  location: string;
  notes: string;
  pickupInformation: string;
  pricingNote: string;
  status: HanhwalStructuredStatus;
  title: string;
  unitPriceKrw: number | null;
  updatedAt: string;
};

export type HanhwalCompetitionPayload = {
  divisionId: string;
  note: string;
};

export type HanhwalEquipmentPayload = {
  featherColor1: string;
  featherColor2: string;
  length: string;
  note: string;
  option: string;
  printText: string;
  quantity: number;
  weight: string;
};

export type HanhwalUniformPayload = {
  note: string;
  quantity: number;
  size: string;
  variant: string;
};

export type HanhwalStructuredPayload =
  | HanhwalCompetitionPayload
  | HanhwalEquipmentPayload
  | HanhwalUniformPayload;

export type HanhwalStructuredSubmission = {
  activityId: string;
  appliedAt: string;
  fulfillmentStatus: HanhwalFulfillmentStatus | null;
  id: string;
  kind: HanhwalStructuredKind;
  paymentStatus: HanhwalPaymentStatus;
  payload: HanhwalStructuredPayload;
  status: "submitted" | "cancelled";
  updatedAt: string;
  userEmail?: string;
  userName: string;
};

export type HanhwalStructuredBreakdown = {
  capacity?: number | null;
  count: number;
  id: string;
  label: string;
};

export type HanhwalStructuredSummary = {
  breakdown: HanhwalStructuredBreakdown[];
  estimatedTotalKrw: number | null;
  submissionCount: number;
  totalQuantity: number;
};

export type HanhwalStructuredResponse = {
  activities?: HanhwalStructuredActivity[];
  canManage?: boolean;
  error?: string;
  submissions?: HanhwalStructuredSubmission[];
  summaries?: Record<string, HanhwalStructuredSummary>;
};

export const hanhwalStructuredLabels: Record<
  HanhwalStructuredKind,
  { emptyEn: string; emptyKo: string; en: string; ko: string }
> = {
  competition: {
    en: "Archery Competition",
    ko: "활쏘기 대회",
    emptyEn: "There is no archery competition accepting applications now.",
    emptyKo: "현재 모집 중인 활쏘기 대회가 없습니다."
  },
  equipment_order: {
    en: "Bow & Arrow Order",
    ko: "활·화살 주문",
    emptyEn: "There is no bow or arrow group order in progress now.",
    emptyKo: "현재 진행 중인 활·화살 공동주문이 없습니다."
  },
  uniform_order: {
    en: "Uniform Order",
    ko: "단체복 주문",
    emptyEn: "There is no uniform order in progress now.",
    emptyKo: "현재 진행 중인 단체복 주문이 없습니다."
  }
};

export function isHanhwalStructuredKind(value: unknown): value is HanhwalStructuredKind {
  return typeof value === "string" && hanhwalStructuredKinds.includes(value as HanhwalStructuredKind);
}

export function isHanhwalStructuredOpen(activity: HanhwalStructuredActivity, now = Date.now()) {
  return activity.status === "open" && Date.parse(activity.deadline) > now;
}

export function formatHanhwalKrw(value: number | null) {
  return value === null ? "" : `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
