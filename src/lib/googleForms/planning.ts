import type { GoogleFormDraft } from "./types";
import { instantiateTemplate, draftFromTemplate, googleFormTemplates } from "./templates";
import { actualResponderUrl } from "./responses";
import { eccNoticeKnowledge, presetNoticeIntroductions } from "./noticeKnowledge";

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
  const isoDate = "\\d{4}-\\d{2}-\\d{2}(?:[T ]\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:\\d{2})?)?";
  const dates = message.match(new RegExp(isoDate, "g")) || [];
  const deadline = new RegExp(`(?:신청\\s*마감|마감|deadline)\\s*[:：]?\\s*(${isoDate})`, "i").exec(message)?.[1] || dates[1] || "";
  const activityDate = new RegExp(`(?:행사\\s*(?:일시|날짜)|활동\\s*(?:일시|날짜)|날짜|일시|activity date|event date)\\s*[:：]?\\s*(${isoDate})`, "i").exec(message)?.[1] || dates.find(value => value !== deadline) || "";
  const location = /(?:장소는?|location\s*:|at\s+the)\s*[:：]?\s*([^,.\n]+?)(?:이고|이며|이고,|,|\.|\n|$)/i.exec(message)?.[1]?.trim() || "";
  if (event && !dates.length && !location && !/내일|다음\s*주|이번\s*주|tomorrow|next\s+week|this\s+week|월요일|수요일|금요일/i.test(message)) {
    return { draft: draftFromTemplate("ecc", templateId, `ECC ${event}`), missing: [] };
  }
  const questions = instantiateTemplate(templateId);
  for (const [pattern, title] of [[/국적|nationality/i, "Nationality / 국적"], [/성별|gender/i, "Gender / 성별"], [/참여 가능|availability/i, "Availability / 참여 가능 여부"]] as const) {
    if (pattern.test(message) && !questions.some(question => question.title === title)) questions.push({ id: crypto.randomUUID(), title, type: "short_answer", required: true, options: [] });
  }
  const draft: GoogleFormDraft = {
    title: event ? `ECC ${event}` : "", clubKey: "ecc", templateId, questions,
    description: "", activityId: "", activityTitle: event, activityDate,
    applicationDeadline: deadline, location, editorEmail: ""
  };
  // Preserve explicit date-only values without inventing a time; clarify relative dates.
  const missing = [!event && "행사명 / Event", !draft.activityDate && "행사 일시 (YYYY-MM-DDTHH:mm+09:00)",
    !draft.applicationDeadline && "신청 마감 (YYYY-MM-DDTHH:mm+09:00)", !location && "장소 / Location"].filter(Boolean) as string[];
  return { draft, missing };
}

function noticeDate(value: string, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
    weekday: "long", ...(/^\d{4}-\d{2}-\d{2}$/.test(value) ? {} : { hour: "numeric" as const, minute: "2-digit" as const }),
  }).format(date) + (/^\d{4}-\d{2}-\d{2}$/.test(value) ? "" : locale === "ko-KR" ? " (한국 시간)" : " (KST)");
}

export function generateActivityNotice(draft: GoogleFormDraft) {
  const englishClass = draft.clubKey === "ecc" && draft.templateId === "ecc_english_class";
  const gathering = draft.clubKey === "ecc" && draft.templateId === "ecc_gathering";
  const title = englishClass ? "English Conversation Class" : draft.activityTitle || draft.title;
  const deadlineKo = noticeDate(draft.applicationDeadline, "ko-KR") || ((englishClass || gathering) ? "해당 요일 전날까지 (당일 신청은 받지 않습니다)" : "");
  const deadlineEn = noticeDate(draft.applicationDeadline, "en-US") || ((englishClass || gathering) ? "Apply by the previous day. Same-day applications will not be accepted." : "");
  const timeKo = noticeDate(draft.activityDate, "ko-KR") || (englishClass ? "목요일 저녁 6시 이후" : "");
  const timeEn = noticeDate(draft.activityDate, "en-US") || (englishClass ? "Thursday, after 6pm" : "");
  const source = draft.clubKey === "ecc" ? eccNoticeKnowledge[draft.templateId] : undefined;
  const preset = presetNoticeIntroductions[draft.templateId];
  const templateDescription = googleFormTemplates.find(item => item.id === draft.templateId)?.description;
  const customDescription = draft.description !== templateDescription ? noticeBody(draft.description) : "";
  const introKo = draft.descriptionKo || customDescription || source?.ko || preset?.ko || "";
  const introEn = draft.descriptionEn || customDescription || source?.en || preset?.en || "";
  const rulesKo = (englishClass || gathering) ? [
    "⚠️ 그룹은 매주 신청자에 따라 바뀝니다.",
    "⚠️ 신청하고 나오지 않으면 다음 모임 때 신청이 제한됩니다.",
  ] : [];
  const rulesEn = (englishClass || gathering) ? [
    "⚠️ Group members change weekly based on applicants.",
    "⚠️ If you do not show up after applying, your next application will be restricted.",
  ] : [];
  if (gathering) {
    rulesKo.push("⚠️ 모임 전날 조별 채팅방이 만들어지며, 활동과 만날 장소는 조원들이 함께 결정합니다.", "⚠️ 활동 비용은 각자 부담합니다.");
    rulesEn.push("⚠️ Group chats are created one day before the gathering. Decide your activity and meeting place together.", "⚠️ Each participant pays their own activity costs.");
  }
  return noticeBody([
    `🧑‍🤝‍🧑 ${title} 공지`,
    introKo,
    deadlineKo && `✅ 신청 기한\n${deadlineKo}`,
    timeKo && `✅ 활동 시간\n${timeKo}`,
    draft.location && `✅ 장소\n${draft.location}`,
    rulesKo.join("\n"),
    `🧑‍🤝‍🧑 ${title} Notice`,
    introEn,
    deadlineEn && `✅ Application\n${deadlineEn}`,
    timeEn && `✅ Activity time\n${timeEn}`,
    draft.location && `✅ Location\n${draft.location}`,
    rulesEn.join("\n"),
  ].filter(Boolean).join("\n\n"));
}

export function noticeBody(notice: string) {
  // Old saved drafts may still contain the former link placeholder or respondent URL.
  return notice.replaceAll("{{GOOGLE_FORM_URL}}", "")
    .replace(/https:\/\/docs\.google\.com\/forms\/[^\s]+/g, "")
    .split("\n").filter(line => !/process notice reviewed|not specified in this template/i.test(line) && !/^\s*(?:신청 링크\s*\/\s*Application Form URL|신청 링크|Application Form URL)\s*:\s*$/.test(line))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function noticeWithFormUrl(notice: string, responderUrl: string) {
  actualResponderUrl(responderUrl);
  return noticeBody(notice);
}
