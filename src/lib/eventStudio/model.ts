import type { GoogleFormDraft, GoogleFormQuestion } from "@/lib/googleForms/types";
import { parseGoogleFormDraft } from "@/lib/googleForms/validation";
import { displayEventDate } from "./dateLabel";

export const studioClubs = ["ecc", "hanhwal", "social_impact_union", "personal"] as const;
export type StudioClub = typeof studioClubs[number];
export type EventPlan = {
  clubKey: StudioClub; title: string; descriptionKo: string; descriptionEn: string;
  noticeKo: string; noticeEn: string; activityDate: string | null;
  applicationDeadline: string | null; location: string | null; capacity: number | null;
  questions: GoogleFormQuestion[]; missingInformation: string[]; requiresReview: true;
  schedule?: { timeZone: string; activityQualifier: string | null; deadlineQualifier: string | null; deadlineEndOfDay: boolean; deadlineConflict: boolean };
};
export class StudioError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function club(value: unknown): StudioClub {
  if (!studioClubs.includes(value as StudioClub)) throw new StudioError("INVALID_CLUB");
  return value as StudioClub;
}
const text = (value: unknown, max: number, optional = false) => {
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim())) throw new StudioError("INVALID_EVENT_TEXT");
  return value.trim();
};
export function missingFields(plan: EventPlan) {
  return [!plan.activityDate && "activityDate", !plan.applicationDeadline && "applicationDeadline",
    !plan.location && "location", plan.capacity === null && "capacity"].filter(Boolean) as string[];
}
export function formDraft(plan: EventPlan, version = 2): GoogleFormDraft {
  const logistics = version >= 2 ? [
    plan.activityDate && `일시 / Date: ${displayEventDate(plan.activityDate, plan.schedule?.timeZone)}${plan.schedule?.activityQualifier ? ` (${plan.schedule.activityQualifier})` : ""}`,
    plan.applicationDeadline && `신청 마감 / Deadline: ${displayEventDate(plan.applicationDeadline, plan.schedule?.timeZone)}${plan.schedule?.deadlineQualifier ? ` (${plan.schedule.deadlineQualifier})` : ""}${plan.schedule?.deadlineEndOfDay ? " (당일 끝 / end of day)" : ""}`,
    plan.location && `장소 / Venue: ${plan.location}`,
    plan.capacity !== null && `모집 인원 / Capacity: ${plan.capacity}`,
    plan.capacity !== null && "정원 초과 응답은 대기자로 분류됩니다. / Responses beyond capacity will be waitlisted.",
  ].filter(Boolean).join("\n") : "";
  const description = [logistics, plan.descriptionKo, plan.descriptionEn].filter(Boolean).join("\n\n");
  if (version >= 2 && description.length > 5000) throw new StudioError("FORM_DESCRIPTION_TOO_LONG");
  return parseGoogleFormDraft({ clubKey: plan.clubKey, title: plan.title, activityTitle: plan.title,
    ...(version >= 2 && plan.capacity !== null ? { capacity: plan.capacity, automationVersion: 1 } : {}),
    templateId: "blank", activityId: "", editorEmail: "", location: plan.location || "",
    activityDate: plan.activityDate || "", applicationDeadline: plan.applicationDeadline || "",
    description, questions: plan.questions });
}
export function parseEventPlan(value: unknown, expectedClub: StudioClub): EventPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StudioError("INVALID_EVENT_PLAN");
  const raw = value as Record<string, unknown>;
  if (club(raw.clubKey) !== expectedClub || raw.requiresReview !== true) throw new StudioError("EVENT_SCOPE_MISMATCH");
  const plan = { clubKey: expectedClub, requiresReview: true } as EventPlan;
  for (const key of ["title", "descriptionKo", "descriptionEn", "noticeKo", "noticeEn"] as const) {
    plan[key] = text(raw[key], key === "title" ? 200 : 5000);
    if (/https?:\/\/|process notice reviewed|not specified in this template/i.test(plan[key])) throw new StudioError("EVENT_TEXT_CONTAINS_LINK_OR_INTERNAL_NOTE");
  }
  for (const key of ["activityDate", "applicationDeadline"] as const) {
    plan[key] = raw[key] === null ? null : text(raw[key], 80);
    if (plan[key] && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(plan[key]!) ||
        !Number.isFinite(Date.parse(plan[key]!)) || new Date(plan[key]!).toISOString().slice(0, 10) !== plan[key]!.slice(0, 10) && plan[key]!.length === 10)) throw new StudioError("INVALID_EVENT_DATE");
    if (plan[key] && new Date(`${plan[key]!.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== plan[key]!.slice(0, 10)) throw new StudioError("INVALID_EVENT_DATE");
  }
  plan.location = raw.location === null ? null : text(raw.location, 300);
  plan.capacity = raw.capacity === null ? null : Number(raw.capacity);
  if (plan.capacity !== null && (!Number.isInteger(raw.capacity) || plan.capacity < 1 || plan.capacity > 100000)) throw new StudioError("INVALID_CAPACITY");
  if (!Array.isArray(raw.questions) || raw.questions.length < 1 || raw.questions.length > 20) throw new StudioError("INVALID_QUESTIONS");
  // Question validation is independent of the organizer's authorized storage scope.
  plan.questions = parseGoogleFormDraft({ clubKey: "general", title: plan.title, templateId: "blank", questions: raw.questions,
    activityDate: plan.activityDate || "", applicationDeadline: plan.applicationDeadline || "" }).questions;
  const titles = new Set<string>();
  for (const q of plan.questions) {
    const title = q.title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
    if (titles.has(title)) throw new StudioError("DUPLICATE_QUESTION_TITLE");
    titles.add(title);
    if (/email|e-mail|이메일|전화|phone|연락처|주소|address|여권|passport|종교|religion|sexual|성적\s*지향|건강|health|medical|질병|주민등록|신분증|학번|student\s*id|government\s*id|emergency contact|비상\s*연락|password|비밀번호|계좌|bank\s*account/i.test(q.title)) throw new StudioError("SENSITIVE_QUESTION_NOT_ALLOWED");
    if (new Set(q.options.map(o => o.toLowerCase())).size !== q.options.length) throw new StudioError("DUPLICATE_CHOICES");
    const choice = ["multiple_choice", "checkbox", "dropdown"].includes(q.type);
    if (choice && q.options.length < 2 || !choice && q.options.length) throw new StudioError("INVALID_CHOICES");
    if (typeof (raw.questions as Record<string, unknown>[])[plan.questions.indexOf(q)].required !== "boolean") throw new StudioError("INVALID_REQUIRED_FLAG");
  }
  const names = plan.questions.filter(q => /\bname\b|이름/i.test(q.title));
  if (names.length !== 1 || !names[0].required || names[0].type !== "short_answer") throw new StudioError("PARTICIPANT_NAME_REQUIRED");
  if (!/[가-힣]/.test(plan.descriptionKo + plan.noticeKo) || !/[a-z]/i.test(plan.descriptionEn + plan.noticeEn)) throw new StudioError("BILINGUAL_CONTENT_REQUIRED");
  plan.missingInformation = missingFields(plan);
  if (raw.schedule && typeof raw.schedule === "object") {
    const schedule = raw.schedule as Record<string, unknown>;
    const timeZone = text(schedule.timeZone, 80);
    try { new Intl.DateTimeFormat("en", { timeZone }); } catch { throw new StudioError("INVALID_EVENT_TIMEZONE"); }
    plan.schedule = { timeZone, activityQualifier: schedule.activityQualifier ? text(schedule.activityQualifier, 80) : null,
      deadlineQualifier: schedule.deadlineQualifier ? text(schedule.deadlineQualifier, 80) : null, deadlineEndOfDay: schedule.deadlineEndOfDay === true, deadlineConflict: schedule.deadlineConflict === true };
  }
  return plan;
}
export function assertGrounded(plan: EventPlan, message: string) {
  for (const value of [plan.activityDate, plan.applicationDeadline]) {
    if (value && !supportsEventDate(value, message)) throw new StudioError("UNSUPPORTED_EVENT_DATE");
  }
  if (plan.location && !message.includes(plan.location)) throw new StudioError("UNSUPPORTED_EVENT_LOCATION");
  if (plan.capacity !== null && !new RegExp(`(?:^|\\D)${plan.capacity}\\s*(?:명|(?:people|participants|persons)\\b)|(?:정원|capacity)\\s*[:=]?\\s*${plan.capacity}(?:\\D|$)`, "i").test(message)) throw new StudioError("UNSUPPORTED_EVENT_CAPACITY");
}

// Accept explicit Korean calendar expressions without relaxing the ban on invented dates,
// years, times, or timezones. Timed Korean expressions require an explicit Korea/KST marker.
export function supportsEventDate(value: string, message: string) {
  if (message.includes(value)) return true;
  const koreaTime = /한국\s*시간|한국\s*표준시|KST|Asia\/Seoul/i.test(message);
  const expressions = message.matchAll(/(?<!\d)(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?)?/g);
  for (const match of expressions) {
    const [, year, month, day, period, hour, minute] = match;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const dateValue = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(dateValue) || new Date(dateValue).toISOString().slice(0, 10) !== date) continue;
    if (hour === undefined) { if (value === date) return true; continue; }
    if (!koreaTime || value.length === 10) continue;
    let h = Number(hour);
    if (period && (h < 1 || h > 12) || !period && h > 23 || Number(minute || 0) > 59) continue;
    if (period) h = h % 12 + (period === "오후" ? 12 : 0);
    const iso = `${date}T${String(h).padStart(2, "0")}:${(minute || "0").padStart(2, "0")}:00+09:00`;
    if (Date.parse(value) === Date.parse(iso)) return true;
  }
  return false;
}

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
export const eventPlanSchema = {
  type: "object", additionalProperties: false,
  properties: {
    clubKey: { type: "string", enum: [...studioClubs] }, title: { type: "string" },
    descriptionKo: { type: "string" }, descriptionEn: { type: "string" }, noticeKo: { type: "string" }, noticeEn: { type: "string" },
    activityDate: nullableString, applicationDeadline: nullableString, location: nullableString,
    capacity: { anyOf: [{ type: "integer" }, { type: "null" }] },
    questions: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { id: { type: "string" }, title: { type: "string" }, type: { type: "string", enum: ["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown", "date", "time"] }, required: { type: "boolean" }, options: { type: "array", items: { type: "string" } } },
      required: ["id", "title", "type", "required", "options"] } },
    missingInformation: { type: "array", items: { type: "string" } }, requiresReview: { type: "boolean", enum: [true] },
  },
  required: ["clubKey", "title", "descriptionKo", "descriptionEn", "noticeKo", "noticeEn", "activityDate", "applicationDeadline", "location", "capacity", "questions", "missingInformation", "requiresReview"],
};
