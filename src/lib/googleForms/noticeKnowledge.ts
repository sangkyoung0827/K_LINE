// Participant-facing facts from ECC_OFFICIAL_ACTIVITY_NOTICES_2026-09-14.md
// and the owner's English Conversation Class notice supplied on 2026-10-06.
// Historical dates, payment details and private conversations are excluded.
export const eccNoticeKnowledge: Record<string, { ko: string; en: string }> = {
  ecc_gathering: {
    ko: "ECC International Gathering은 다양한 나라의 회원들이 작은 조로 만나 서로의 문화를 나누는 모임입니다. 조원들과 함께 활동과 만날 장소를 정하고 교류합니다.",
    en: "ECC International Gathering brings members from different countries together in small groups to share their cultures. Each group chooses its activity and meeting place together.",
  },
  ecc_english_class: {
    ko: "ECC English Conversation Class 참여 신청을 받습니다. 매주 신청자를 바탕으로 새롭게 편성된 그룹에서 영어로 대화하며 교류하는 모임입니다.",
    en: "Applications are open for the ECC English Conversation Class. Meet a newly arranged group of applicants each week for English conversation and exchange.",
  },
};

export function resolveNoticeTemplate(clubKey: string, templateId: string, title: string) {
  if (clubKey !== "ecc" || templateId !== "ecc_general") return templateId;
  if (/\binternational\s+gathering\b|\becc\s+gathering\b|^gathering$|게더링/i.test(title.trim())) return "ecc_gathering";
  if (/\benglish\s+(?:conversation\s+)?class\b|영어\s*(?:회화|수업)|잉글리시\s*클래스/i.test(title)) return "ecc_english_class";
  if (/\bMT\b|엠티/i.test(title)) return "ecc_mt";
  if (/\bOT\b|orientation|오리엔테이션/i.test(title)) return "ecc_ot";
  if (/farewell|종강/i.test(title)) return "ecc_farewell";
  if (/special\s+event|스페셜\s*이벤트/i.test(title)) return "ecc_special_event";
  if (/staff\s+recruitment|임원\s*모집/i.test(title)) return "ecc_staff_recruitment";
  return templateId;
}

// Only recurring participant-facing rules, not historical schedules or payment details.
export const verifiedNoticeRules: Record<string, { ko: string[]; en: string[] }> = {
  ecc_gathering: {
    ko: ["모임 전날까지 신청하며 당일 신청은 받지 않습니다.", "그룹은 매주 신청자에 따라 바뀝니다.", "모임 전날 조별 채팅방이 만들어집니다. 조원들이 활동과 만날 장소를 함께 결정합니다.", "활동 비용은 각자 부담합니다.", "신청 후 불참하면 다음 모임 신청이 제한됩니다."],
    en: ["Apply by the previous day; same-day applications are not accepted.", "Groups change weekly based on applicants.", "Group chats are created one day before the gathering. Group members decide their activity and meeting place together.", "Each participant pays their own activity costs.", "If you do not show up after applying, your next application will be restricted."],
  },
  ecc_english_class: {
    ko: ["해당 요일 전날까지 신청하며 당일 신청은 받지 않습니다.", "활동 시간은 목요일 저녁 6시 이후입니다. 이번 행사에 별도 일정이 지정되면 그 일정을 따릅니다.", "그룹은 매주 신청자에 따라 바뀝니다.", "신청 후 불참하면 다음 모임 신청이 제한됩니다."],
    en: ["Apply by the previous day; same-day applications are not accepted.", "The regular activity time is Thursday, after 6pm. Use an explicitly supplied event schedule instead when present.", "Groups change weekly based on applicants.", "If you do not show up after applying, your next application will be restricted."],
  },
};

// These presets have a verified activity identity, not an itinerary or event rules.
export const presetNoticeIntroductions: Record<string, { ko: string; en: string }> = {
  ecc_general: { ko: "ECC 활동 참여 신청을 받습니다.", en: "Apply to participate in this ECC activity." },
  ecc_ot: { ko: "ECC 오리엔테이션 참여 신청을 받습니다.", en: "Apply to participate in the ECC orientation." },
  ecc_mt: { ko: "ECC MT 참여 신청을 받습니다.", en: "Apply to participate in the ECC MT." },
  ecc_special_event: { ko: "ECC 특별 이벤트 참여 신청을 받습니다.", en: "Apply to participate in this ECC special event." },
  ecc_farewell: { ko: "ECC 종강총회 참여 신청을 받습니다.", en: "Apply to participate in the ECC farewell party." },
  ecc_staff_recruitment: { ko: "ECC 임원 모집 신청을 받습니다.", en: "Applications are open for ECC staff recruitment." },
  general_activity: { ko: "K_LINE 활동 참여 신청을 받습니다.", en: "Apply to participate in this K_LINE activity." },
};
