import type { GoogleFormDraft, GoogleFormQuestion } from "@/lib/googleForms/types";
import { parseGoogleFormDraft } from "@/lib/googleForms/validation";

export const studioClubs = ["ecc", "hanhwal", "social_impact_union"] as const;
export type StudioClub = typeof studioClubs[number];
export type EventPlan = {
  clubKey: StudioClub; title: string; descriptionKo: string; descriptionEn: string;
  noticeKo: string; noticeEn: string; activityDate: string | null;
  applicationDeadline: string | null; location: string | null; capacity: number | null;
  questions: GoogleFormQuestion[]; missingInformation: string[]; requiresReview: true;
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
export function formDraft(plan: EventPlan): GoogleFormDraft {
  if (plan.clubKey === "hanhwal") throw new StudioError("CLUB_ADAPTER_NOT_READY", 409);
  return parseGoogleFormDraft({ clubKey: plan.clubKey, title: plan.title, activityTitle: plan.title,
    templateId: "blank", activityId: "", editorEmail: "", location: plan.location || "",
    activityDate: plan.activityDate || "", applicationDeadline: plan.applicationDeadline || "",
    description: `${plan.descriptionKo}\n\n${plan.descriptionEn}`, questions: plan.questions });
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
  // Reuse the established question/date validator; HANHWAL never executes under this temporary parsing key.
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
  return plan;
}
export function assertGrounded(plan: EventPlan, message: string) {
  for (const value of [plan.activityDate, plan.applicationDeadline]) {
    if (value && !message.includes(value)) throw new StudioError("UNSUPPORTED_EVENT_DATE");
  }
  if (plan.location && !message.includes(plan.location)) throw new StudioError("UNSUPPORTED_EVENT_LOCATION");
  if (plan.capacity !== null && !new RegExp(`(?:^|\\D)${plan.capacity}\\s*(?:명|(?:people|participants|persons)\\b)|(?:정원|capacity)\\s*[:=]?\\s*${plan.capacity}(?:\\D|$)`, "i").test(message)) throw new StudioError("UNSUPPORTED_EVENT_CAPACITY");
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
