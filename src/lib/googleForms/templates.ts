import type { GoogleFormQuestion } from "./types";

export type GoogleFormTemplate = {
  id: string;
  label: string;
  description: string;
  questions: Omit<GoogleFormQuestion, "id">[];
};

const identityQuestions: GoogleFormTemplate["questions"] = [
  { title: "Email / 이메일", type: "short_answer", required: true, options: [] },
  { title: "Name / 이름", type: "short_answer", required: true, options: [] }
];

export const googleFormTemplates: GoogleFormTemplate[] = [
  {
    id: "ecc_general",
    label: "ECC General Activity",
    description: "General ECC activity application",
    questions: [...identityQuestions, { title: "Nationality / 국적", type: "short_answer", required: true, options: [] }, { title: "Requests / 요청사항", type: "paragraph", required: false, options: [] }]
  },
  {
    id: "ecc_gathering",
    label: "ECC Gathering",
    description: "ECC International Gathering application",
    questions: [...identityQuestions, { title: "Available day / 가능한 요일", type: "checkbox", required: true, options: ["Monday / 월요일", "Wednesday / 수요일"] }, { title: "Food or allergy notes / 음식·알레르기", type: "paragraph", required: false, options: [] }]
  },
  {
    id: "ecc_ot",
    label: "ECC OT",
    description: "ECC orientation application",
    questions: [...identityQuestions, { title: "Department / 학과", type: "short_answer", required: false, options: [] }, { title: "Requests / 요청사항", type: "paragraph", required: false, options: [] }]
  },
  {
    id: "ecc_mt",
    label: "ECC MT",
    description: "ECC MT application",
    questions: [...identityQuestions, { title: "Dietary restrictions / 식이 제한", type: "paragraph", required: false, options: [] }, { title: "Emergency note / 비상 참고사항", type: "paragraph", required: false, options: [] }]
  },
  {
    id: "general_activity",
    label: "General K_LINE Activity",
    description: "General K_LINE activity application",
    questions: [...identityQuestions, { title: "Requests / 요청사항", type: "paragraph", required: false, options: [] }]
  },
  { id: "blank", label: "Blank Form", description: "Start with no preset questions", questions: [] }
];

export function instantiateTemplate(templateId: string) {
  const template = googleFormTemplates.find((item) => item.id === templateId) ?? googleFormTemplates.at(-1)!;
  return template.questions.map((question) => ({ ...question, id: crypto.randomUUID() }));
}
