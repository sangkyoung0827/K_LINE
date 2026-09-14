import { preferenceCategoryIds, type PreferenceCategory } from "@/lib/activity-preferences/taxonomy";

export const siuPath = "/social-impact-union";
export const siuSource = "social_impact_union";
export const siuRoles = ["user", "official_member", "admin", "super_admin", "developer"] as const;
export type SiuRole = typeof siuRoles[number];
export type SiuStatus = "draft" | "published" | "closed" | "cancelled" | "hidden";
export type SiuActivityInput = {
  title: string; short_description: string; description: string;
  categories: PreferenceCategory[]; tags: string[]; cover_image_url: string | null;
  starts_at: string; ends_at: string; location_name: string; location_address: string | null;
  capacity: number | null; application_deadline: string | null; is_free: boolean; fee_krw: number | null;
  preparation_notes: string | null; contact_note: string | null; open_chat_url: string | null; status: SiuStatus;
};
export type SiuActivity = SiuActivityInput & {
  id: string; creator_display_name: string; created_at: string; updated_at: string; application_count: number;
};
export type SiuPrivateActivity = SiuActivity & { creator_user_key: string };
export type SiuApplication = {
  id: string; activity_id: string; user_key: string; display_name: string; status: "applied" | "cancelled";
  applied_at: string; cancelled_at: string | null; rating: number | null; rated_at: string | null;
  categories_snapshot: PreferenceCategory[]; tags_snapshot: string[]; title_snapshot: string; preference_synced: boolean;
};
export type SiuAccess = {
  authenticated: boolean; email: string; displayName: string; role: SiuRole; globalRank: number;
  isOfficialMember: boolean; isAdmin: boolean; isSuperAdmin: boolean; isDeveloper: boolean; isReadOnly: boolean;
};
export type SiuDetail = {
  activity: SiuActivity; access: SiuAccess; canManage: boolean; canEdit: boolean;
  application: Pick<SiuApplication, "id" | "status" | "rating" | "rated_at"> | null;
};
export type SiuMyItem = { activity: SiuActivity; application: SiuDetail["application"] };
export class SiuError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function siuId(value: string) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new SiuError("NOT_FOUND", 404);
  return value;
}
export function validateActivity(value: unknown): SiuActivityInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SiuError("INVALID_INPUT");
  const input = value as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    if (input[key] != null && typeof input[key] !== "string") throw new SiuError("INVALID_" + key.toUpperCase());
    const result = (input[key] as string | undefined)?.trim() || "";
    if (result.length > max || (required && !result)) throw new SiuError("INVALID_" + key.toUpperCase());
    return result;
  };
  const date = (key: string, required = false) => {
    const raw = text(key, 40, required);
    if (!raw) return null;
    if (!/T.*(Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw))) throw new SiuError("INVALID_DATE");
    return new Date(raw).toISOString();
  };
  const number = (key: string, min: number, max: number) => {
    const raw = input[key];
    if (raw == null || raw === "") return null;
    if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < min || raw > max) throw new SiuError("INVALID_" + key.toUpperCase());
    return raw;
  };
  const url = (key: string) => {
    const raw = text(key, 2000);
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
      return parsed.href;
    } catch { throw new SiuError("INVALID_URL"); }
  };
  if (!Array.isArray(input.categories) || input.categories.length < 1 || input.categories.length > 14
    || input.categories.some((x) => typeof x !== "string" || !preferenceCategoryIds.has(x))) throw new SiuError("INVALID_CATEGORY");
  if (!Array.isArray(input.tags) || input.tags.length > 10 || input.tags.some((x) => typeof x !== "string")) throw new SiuError("INVALID_TAG");
  const tags = [...new Set((input.tags as string[]).map((x) => x.trim().toLowerCase().replace(/[ -]+/g, "_")).filter(Boolean))];
  if (tags.some((x) => !/^[a-z0-9_]{1,64}$/.test(x))) throw new SiuError("INVALID_TAG");
  const starts_at = date("starts_at", true)!;
  const ends_at = date("ends_at", true)!;
  const application_deadline = date("application_deadline");
  if (ends_at < starts_at || (application_deadline && application_deadline > starts_at)) throw new SiuError("INVALID_DATE");
  if (!["draft", "published", "closed"].includes(String(input.status))) throw new SiuError("INVALID_STATUS");
  if (typeof input.is_free !== "boolean") throw new SiuError("INVALID_FEE");
  const fee = number("fee_krw", 0, 10000000);
  if (!input.is_free && (!fee || fee < 1)) throw new SiuError("INVALID_FEE");
  // Remote images are optional HTTPS URLs; no server fetching or SVG/HTML upload path.
  return {
    title: text("title", 120, true), short_description: text("short_description", 300, true),
    description: text("description", 10000, true), categories: [...new Set(input.categories)] as PreferenceCategory[],
    tags, cover_image_url: url("cover_image_url"), starts_at, ends_at, application_deadline,
    location_name: text("location_name", 200, true), location_address: text("location_address", 400) || null,
    capacity: number("capacity", 1, 100000), is_free: input.is_free, fee_krw: input.is_free ? 0 : fee,
    preparation_notes: text("preparation_notes", 2000) || null, contact_note: text("contact_note", 500) || null,
    open_chat_url: url("open_chat_url"), status: input.status as SiuStatus
  };
}
export function canApply(activity: SiuActivity, now = Date.now()) {
  return activity.status === "published" && now < Date.parse(activity.application_deadline || activity.starts_at)
    && now < Date.parse(activity.starts_at) && (activity.capacity === null || activity.application_count < activity.capacity);
}
export const statusLabels: Record<SiuStatus, { en: string; ko: string }> = {
  draft: { en: "Draft", ko: "임시저장" }, published: { en: "Published", ko: "공개" },
  closed: { en: "Closed", ko: "모집 마감" }, cancelled: { en: "Cancelled", ko: "활동 취소" }, hidden: { en: "Hidden", ko: "숨김" }
};
export function siuDate(value: string, ko: boolean) {
  return new Intl.DateTimeFormat(ko ? "ko-KR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}
