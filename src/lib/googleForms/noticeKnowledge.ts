// Participant-facing facts from ECC_OFFICIAL_ACTIVITY_NOTICES_2026-09-14.md
// and the owner's English Conversation Class notice supplied on 2026-10-06.
// Historical dates, payment details and private conversations are excluded.
export const eccNoticeKnowledge: Record<string, { ko: string; en: string }> = {
  ecc_gathering: {
    ko: "ECC International Gathering에서 다양한 나라의 회원들과 조별로 교류합니다.",
    en: "Meet ECC members from different countries in small groups at International Gathering.",
  },
  ecc_english_class: {
    ko: "ECC English Conversation Class 참여 신청을 받습니다.",
    en: "Applications are open for the ECC English Conversation Class.",
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
