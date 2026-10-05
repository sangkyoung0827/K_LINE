import type { GoogleFormDraft } from "./types";
import { instantiateTemplate, draftFromTemplate } from "./templates";
import { actualResponderUrl } from "./responses";

export const googleFormsActionRegistry = {
  DRAFT_GOOGLE_FORM: { write: true }, PREVIEW_GOOGLE_FORM: { write: false },
  UPDATE_GOOGLE_FORM_DRAFT: { write: true }, CREATE_GOOGLE_FORM: { write: true },
  GET_GOOGLE_FORM: { write: false }, OPEN_FORM_RECRUITMENT: { write: true },
  CLOSE_FORM_RECRUITMENT: { write: true }, SYNC_GOOGLE_FORM_RESPONSES: { write: true },
  READ_FORM_RESPONSE_COUNT: { write: false }, READ_FORM_RESPONSE_SUMMARY: { write: false },
  GENERATE_ACTIVITY_NOTICE: { write: true }, PREVIEW_ACTIVITY_NOTICE: { write: false },
  UPDATE_ACTIVITY_NOTICE: { write: true }, PUBLISH_ACTIVITY_NOTICE: { write: true },
  CREATE_ACTIVITY_WITH_FORM_AND_NOTICE: { write: true }
} as const;
export type GoogleFormsAction = keyof typeof googleFormsActionRegistry;

export function planActivity(message: string): { draft: GoogleFormDraft; missing: string[] } {
  const templateId = /gathering|게더링/i.test(message) ? "ecc_gathering" : /\bMT\b/i.test(message) ? "ecc_mt" :
    /farewell|종강/i.test(message) ? "ecc_farewell" : /english class|영어.*수업/i.test(message) ? "ecc_english_class" : "ecc_general";
  const event = /International Gathering|English Class|Farewell|Special Event|\bMT\b|\bOT\b/i.exec(message)?.[0] || "";
  const dates = message.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?/g) || [];
  const location = /(?:장소는?|location\s*:|at\s+the)\s*([^,.\n]+?)(?:이고|이며|이고,|,|\.|\n|$)/i.exec(message)?.[1]?.trim() || "";
  if (event && !dates.length && !location && !/내일|다음\s*주|이번\s*주|tomorrow|next\s+week|this\s+week|월요일|수요일|금요일/i.test(message)) {
    return { draft: draftFromTemplate("ecc", templateId, `ECC ${event}`), missing: [] };
  }
  const questions = instantiateTemplate(templateId);
  for (const [pattern, title] of [[/국적|nationality/i, "Nationality / 국적"], [/성별|gender/i, "Gender / 성별"], [/참여 가능|availability/i, "Availability / 참여 가능 여부"]] as const) {
    if (pattern.test(message) && !questions.some(question => question.title === title)) questions.push({ id: crypto.randomUUID(), title, type: "short_answer", required: true, options: [] });
  }
  const draft: GoogleFormDraft = {
    title: event ? `ECC ${event}` : "", clubKey: "ecc", templateId, questions,
    description: "", activityId: "", activityTitle: event, activityDate: dates[0] || "",
    applicationDeadline: dates[1] || "", location, editorEmail: ""
  };
  // Relative dates and missing times are deliberately clarified, not silently guessed.
  const missing = [!event && "행사명 / Event", !draft.activityDate && "행사 일시 (YYYY-MM-DDTHH:mm+09:00)",
    !draft.applicationDeadline && "신청 마감 (YYYY-MM-DDTHH:mm+09:00)", !location && "장소 / Location"].filter(Boolean) as string[];
  return { draft, missing };
}

export function generateActivityNotice(draft: GoogleFormDraft) {
  return [`[${draft.title}]`, `행사명 / Event: ${draft.activityTitle || draft.title}`,
    draft.activityDate && `일시 / Date & Time: ${draft.activityDate}`,
    draft.location && `장소 / Location: ${draft.location}`,
    draft.description && `활동 내용 / Activities: ${draft.description}`,
    draft.applicationDeadline && `신청 마감 / Application Deadline: ${draft.applicationDeadline}`,
    "참여 안내 / How to Join: Complete the application form / 신청폼을 작성해주세요.",
    "신청 링크 / Application Form URL: {{GOOGLE_FORM_URL}}"].filter(Boolean).join("\n\n");
}

export function noticeWithFormUrl(notice: string, responderUrl: string) {
  const url = actualResponderUrl(responderUrl);
  if (!notice.includes("{{GOOGLE_FORM_URL}}")) throw new Error("NOTICE_FORM_LINK_PLACEHOLDER_REQUIRED");
  return notice.replaceAll("{{GOOGLE_FORM_URL}}", url);
}
