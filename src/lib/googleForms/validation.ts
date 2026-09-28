import { cleanText } from "@/lib/supabaseServer";
import { googleFormTemplates } from "./templates";
import { googleFormClubKeys, type GoogleFormDraft, type GoogleFormQuestion, type GoogleQuestionType } from "./types";

const questionTypes = new Set<GoogleQuestionType>(["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown", "date", "time"]);

export function parseGoogleFormDraft(value: unknown): GoogleFormDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_FORM_DRAFT");
  const input = value as Record<string, unknown>;
  const clubKey = cleanText(input.clubKey, 40) as GoogleFormDraft["clubKey"];
  if (!googleFormClubKeys.includes(clubKey)) throw new Error("INVALID_CLUB");
  const title = cleanText(input.title, 200);
  if (!title) throw new Error("TITLE_REQUIRED");
  const templateId = cleanText(input.templateId, 80) || "blank";
  if (!googleFormTemplates.some((item) => item.id === templateId)) throw new Error("INVALID_TEMPLATE");
  if (!Array.isArray(input.questions) || input.questions.length > 100) throw new Error("INVALID_QUESTIONS");
  const questions: GoogleFormQuestion[] = input.questions.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_QUESTION");
    const item = raw as Record<string, unknown>;
    const type = cleanText(item.type, 40) as GoogleQuestionType;
    const questionTitle = cleanText(item.title, 300);
    if (!questionTitle || !questionTypes.has(type)) throw new Error("INVALID_QUESTION");
    const options = Array.isArray(item.options) ? item.options.map((option) => cleanText(option, 200)).filter(Boolean).slice(0, 100) : [];
    if (["multiple_choice", "checkbox", "dropdown"].includes(type) && options.length < 1) throw new Error("QUESTION_OPTIONS_REQUIRED");
    return { id: cleanText(item.id, 100) || `question-${index}`, title: questionTitle, type, required: item.required === true, options };
  });
  const applicationDeadline = cleanText(input.applicationDeadline, 60);
  if (applicationDeadline && !Number.isFinite(Date.parse(applicationDeadline))) throw new Error("INVALID_DEADLINE");
  const editorEmail = cleanText(input.editorEmail, 240).toLowerCase();
  if (editorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editorEmail)) throw new Error("INVALID_EDITOR_EMAIL");
  return { clubKey, title, description: cleanText(input.description, 5000), activityId: cleanText(input.activityId, 200), activityTitle: cleanText(input.activityTitle, 200), activityDate: cleanText(input.activityDate, 80), location: cleanText(input.location, 300), applicationDeadline, editorEmail, templateId, questions };
}
