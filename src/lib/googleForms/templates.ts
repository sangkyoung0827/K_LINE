import type { GoogleFormDraft, GoogleFormQuestion } from "./types";

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
    // Source: owner-approved ECC OFFICIAL CHAT notices in ecc/activity-guide.ts.
    description: "ECC International Gathering\n\nParticipants are assigned to groups. A group chat is created one day before the gathering, and the group decides its activity and meeting place together. Apply by the previous day; same-day applications are not accepted. Groups change weekly. Each participant pays their own activity costs.\n\n참가자는 조로 나뉘며, 모임 전날 만들어지는 조별 채팅방에서 활동과 만날 장소를 함께 결정합니다. 전날까지 신청하며 당일 신청은 받지 않습니다. 조는 매주 새로 편성되고 활동 비용은 각자 부담합니다.",
    questions: [
      { ...identityQuestions[1], title: "KakaoTalk name / 카카오톡에 등록된 이름" },
      { title: "Gender / 성별", type: "multiple_choice", required: true, options: ["Male / 남성", "Female / 여성", "Other / 기타", "Prefer not to say / 밝히고 싶지 않음"] },
      { title: "Nationality / 국적", type: "short_answer", required: true, options: [] },
      { title: "Preferred food / 선호하는 음식", type: "short_answer", required: true, options: [] },
      { title: "Other requests / 기타 요청사항", type: "paragraph", required: false, options: [] }
    ]
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
  ...["ecc_english_class", "ecc_special_event", "ecc_farewell", "ecc_staff_recruitment"].map((id) => ({
    id, label: id.replaceAll("_", " "), description: "ECC activity application",
    questions: [...identityQuestions, { title: "Requests / 요청사항", type: "paragraph" as const, required: false, options: [] }]
  })),
  { id: "blank", label: "Blank Form", description: "Start with no preset questions", questions: [] }
];

export function instantiateTemplate(templateId: string) {
  const template = googleFormTemplates.find((item) => item.id === templateId) ?? googleFormTemplates.at(-1)!;
  return template.questions.map((question) => ({ ...question, options: [...question.options], id: crypto.randomUUID() }));
}

export function draftFromTemplate(clubKey: GoogleFormDraft["clubKey"], templateId: string, title: string): GoogleFormDraft {
  const template = googleFormTemplates.find((item) => item.id === templateId);
  if (!template || !template.questions.length) throw new Error("ACTIVITY_TEMPLATE_REQUIRED");
  return {
    clubKey, templateId, title, activityTitle: title,
    description: template.description, questions: instantiateTemplate(templateId),
    activityId: "", activityDate: "", applicationDeadline: "", location: "", editorEmail: ""
  };
}
