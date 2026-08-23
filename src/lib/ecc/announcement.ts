export type EccAnnouncementRequest = {
  context: string;
  fallback: string;
  kind: "general" | "reregistration";
  semester: 1 | 2;
  termKo: string;
  year: number;
};

function seoulYearMonth(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getUTCMonth() + 1);
  return { month, year };
}

export function getCurrentEccAcademicTerm(now = new Date()) {
  const { month, year } = seoulYearMonth(now);
  const semester = (month <= 6 ? 1 : 2) as 1 | 2;
  return {
    semester,
    termEn: `${year} ${semester === 1 ? "Spring" : "Fall"} Semester`,
    termKo: `${year}년 ${semester}학기`,
    year
  };
}

function isAnnouncementRequest(message: string) {
  const normalized = message.toLowerCase();
  const mentionsEcc = /(?:^|\s|["'‘’“”])ecc(?:\s|$|[,.!?"'‘’“”])|이씨씨/.test(normalized);
  const asksForAnnouncement = /공지|안내문|공고|notice|announcement|카카오톡.*(?:글|메시지)/.test(normalized);
  return mentionsEcc && asksForAnnouncement;
}

function isReregistration(message: string) {
  return /재등록|기존\s*회원|renew(?:al)?|re[ -]?registration|returning\s+member/i.test(message);
}

function buildReregistrationFallback(termKo: string) {
  return `📢 ${termKo} ECC 기존 회원 재등록 안내

안녕하세요, ECC입니다! 😊
${termKo}에도 ECC와 함께 활동할 기존 회원분들을 대상으로 재등록을 진행합니다.

👥 재등록 대상
지난 학기까지 ECC 회원으로 활동했고, ${termKo}에도 활동을 이어가고 싶은 기존 회원

📝 재등록 방법
아래 재등록 신청서를 작성해 주세요.
• 신청 링크: [운영진 입력: 재등록 신청 링크]

📅 신청 기간
• [운영진 입력: 신청 시작일] ~ [운영진 입력: 신청 마감일]

💳 회비 안내
• 회비: [운영진 입력: 금액]
• 납부 방법: [운영진 입력: 계좌 또는 납부 방법]
• 입금자명은 신청서에 작성한 이름과 동일하게 입력해 주세요.

✅ 재등록 완료
신청서 제출과 회비 납부가 모두 확인되면 ${termKo} ECC 재등록이 완료됩니다. 운영진 확인에는 시간이 조금 걸릴 수 있습니다.

International Gathering, English Conversation Class, MT, Special Event 등 다양한 ECC 활동으로 다시 만나요!

문의: [운영진 입력: ECC 공식 문의 채널]
감사합니다.
ECC 운영진`;
}

export function detectEccAnnouncementRequest(
  message: string,
  now = new Date()
): EccAnnouncementRequest | null {
  if (!isAnnouncementRequest(message)) return null;

  const term = getCurrentEccAcademicTerm(now);
  const kind = isReregistration(message) ? "reregistration" : "general";
  const fallback = kind === "reregistration"
    ? buildReregistrationFallback(term.termKo)
    : `[ECC 공지]\n\n안녕하세요, ECC입니다!\n\n[운영진 입력: 공지 내용]\n\n감사합니다.\nECC 운영진`;

  const context = [
    "WOOHYUKMON ECC ANNOUNCEMENT STYLE GUIDE",
    "This is a trusted, privacy-safe style profile derived only from the public notice record in ECC_RAW_MASTER_WOOHYUKMON_PACKAGE. Never use member_response or member_operational_data rows when drafting a notice.",
    `Current Seoul academic term: ${term.termKo} (${term.termEn}).`,
    `Detected task: ${kind === "reregistration" ? "existing-member re-registration notice" : "general ECC notice"}.`,
    "",
    "ECC house style:",
    "- Return a finished, copy-ready KakaoTalk notice, not advice about how to write one.",
    "- Use a clear headline, a short warm greeting from ECC, compact information blocks, and a direct action request.",
    "- Keep the tone friendly, energetic, and practical like a student club officer. Avoid corporate or generic AI wording.",
    "- Use a small number of functional emojis as section markers. Do not make the notice flashy or childish.",
    "- Mention English activity names naturally when relevant: International Gathering, English Conversation Class, MT, and Special Event.",
    "- Write primarily in the user's language. Short English activity labels are allowed because they are part of ECC's established bilingual style.",
    "- Do not add a sources section, commentary, or an explanation before the notice.",
    "- Never include or infer names, student numbers, contacts, nationality, payment records, or any other raw member data.",
    "- Never invent a registration deadline, fee, bank account, form URL, or contact channel. If the user did not provide one, keep an explicit [운영진 입력: ...] placeholder.",
    "- If the request is for re-registration, the headline and body must explicitly use the current academic term shown above and address existing members, not new applicants.",
    "",
    "Minimum re-registration structure:",
    "1. Headline with the current term and ECC existing-member re-registration",
    "2. Warm ECC greeting and one-sentence purpose",
    "3. Eligibility",
    "4. Application method and link",
    "5. Application period",
    "6. Membership fee/payment guidance",
    "7. Completion/confirmation process",
    "8. Brief activity reminder and contact placeholder",
    "",
    "Use this safe fallback draft as the factual baseline. Improve its rhythm and readability without replacing placeholders with invented facts:",
    fallback
  ].join("\n");

  return {
    context,
    fallback,
    kind,
    semester: term.semester,
    termKo: term.termKo,
    year: term.year
  };
}
