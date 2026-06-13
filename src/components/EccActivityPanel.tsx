"use client";

import {
  CalendarCheck,
  CheckCircle2,
  Clipboard,
  Copy,
  Megaphone,
  Save,
  Shuffle,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { adminStorageKeys } from "@/lib/adminStorageKeys";
import { useLanguage } from "@/components/LanguageProvider";

type Language = "ko" | "en";

type EccMember = {
  id: string;
  name: string;
  affiliation: string;
  gatheringCount: number;
  mtCount: number;
  specialEvents: string[];
  note: string;
  raw: string;
};

type EccTeam = {
  id: string;
  name: string;
  members: EccMember[];
};

type NoticeForm = {
  title: string;
  dateTime: string;
  location: string;
  preparation: string;
  memo: string;
};

type ApplicationType = "gathering" | "mt" | "special" | "opening" | "farewell";

type ApplicationForm = {
  name: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  otherRequests: string;
};

type EccApplication = ApplicationForm & {
  id: string;
  type: ApplicationType;
  activityTitle: string;
  status: string;
  createdAt: string;
};

type ApplicationCounts = Record<ApplicationType, number>;

type ApplicationsApiResponse = {
  counts?: Partial<ApplicationCounts>;
  applications?: EccApplication[];
  error?: string;
};

type PaymentDrafts = Record<string, boolean>;

const initialNoticeForms: Record<Language, NoticeForm> = {
  ko: {
    title: "ECC 정기 모임",
    dateTime: "",
    location: "",
    preparation: "편한 복장, 개인 음료",
    memo: "늦거나 불참하는 경우 조장에게 미리 알려주세요."
  },
  en: {
    title: "ECC Regular Gathering",
    dateTime: "",
    location: "",
    preparation: "Comfortable clothes, personal drink",
    memo: "If you will be late or absent, please tell your team leader in advance."
  }
};

const initialApplicationForm: ApplicationForm = {
  name: "",
  gender: "",
  nationality: "",
  preferredFood: "",
  otherRequests: ""
};

const applicationTypes: Array<{
  type: ApplicationType;
  labels: Record<Language, { title: string; description: string }>;
}> = [
  {
    type: "gathering",
    labels: {
      ko: {
        title: "International Gathering 신청",
        description: "ECC 국제 교류 모임 참여 신청"
      },
      en: {
        title: "International Gathering Application",
        description: "Apply for the ECC international gathering"
      }
    }
  },
  {
    type: "mt",
    labels: {
      ko: {
        title: "MT 신청",
        description: "ECC MT 참여 신청"
      },
      en: {
        title: "MT Application",
        description: "Apply for the ECC MT"
      }
    }
  },
  {
    type: "special",
    labels: {
      ko: {
        title: "Special Event 신청",
        description: "ECC 특별 이벤트 참여 신청"
      },
      en: {
        title: "Special Event Application",
        description: "Apply for an ECC special event"
      }
    }
  },
  {
    type: "opening",
    labels: {
      ko: {
        title: "개강총회 신청",
        description: "ECC 개강총회 참여 신청"
      },
      en: {
        title: "Semester Opening Party Application",
        description: "Apply for the ECC semester opening party"
      }
    }
  },
  {
    type: "farewell",
    labels: {
      ko: {
        title: "종강총회 신청",
        description: "ECC 종강총회 참여 신청"
      },
      en: {
        title: "Farewell Party Application",
        description: "Apply for the ECC farewell party"
      }
    }
  }
];

const copy = {
  ko: {
    languageEyebrow: "Language",
    languageTitle: "언어 선택",
    languageDescription:
      "한국어 또는 영어를 선택하면 회원 현황, 조 편성, 카카오톡 공지문 문구가 해당 언어로 바뀝니다.",
    applicationEyebrow: "Applications",
    applicationTitle: "활동 신청",
    applicationDescription:
      "구글폼처럼 활동을 선택하고 질문지를 작성하면 신청이 저장됩니다. 신청자 수는 활동별로 누적됩니다.",
    applicantCount: "누적 신청자",
    applicationFormTitle: "신청서 작성",
    kakaoNameLabel: "이름 (카카오톡에 등록된 이름)",
    genderLabel: "성별",
    genderPlaceholder: "성별 선택",
    genderMale: "남성",
    genderFemale: "여성",
    genderOther: "기타",
    genderPreferNot: "밝히고 싶지 않음",
    nationalityLabel: "국적",
    preferredFoodLabel: "선호하는 음식",
    requestLabel: "기타 요청사항",
    submitApplication: "신청하기",
    applicationSubmitted: "신청되었습니다.",
    applicationLoading: "신청 정보를 불러오는 중입니다.",
    applicationStorageError:
      "신청 저장소 연결에 문제가 있습니다. 잠시 후 다시 시도해 주세요.",
    applicantListTitle: "신청자 명단",
    applicantListDescription:
      "슈퍼관리자로 로그인한 경우에만 활동별 신청자 명단을 확인할 수 있습니다.",
    paidHeader: "활동비",
    paidLabel: "납부",
    savePayments: "저장",
    paymentsSaved: "활동비 납부 상태가 저장되었습니다.",
    resetApplicants: "신청자 초기화",
    resetConfirm: "정말 신청자를 초기화 하시겠습니까?",
    resetComplete: "신청자가 초기화되었습니다.",
    copyNamesTitle: "이름 복사용 목록",
    copyNamesDescription: "아래 영역은 드래그 선택과 복사가 쉽도록 이름만 줄바꿈으로 정리합니다.",
    noApplicants: "아직 신청자가 없습니다.",
    submittedAt: "신청 시간",
    members: "Members",
    registeredMembers: "등록된 ECC 회원",
    totalGathering: "전체 gathering 참여 합계",
    totalMt: "전체 MT 참여 합계",
    specialEventsTotal: "특별 이벤트 기록 수",
    memberImport: "Member import",
    importTitle: "회원 현황 붙여넣기",
    importDescription:
      "엑셀이나 구글시트에서 이름, 소속, gathering, MT, 특별 이벤트, 비고 열을 복사해 붙여넣으면 회원별 활동 현황 표로 바뀝니다.",
    sample: "Sample",
    saveMemberStatus: "Save Member Status",
    clear: "Clear",
    readOnly: "Read-only view",
    readOnlyTitle: "회원 현황 입력은 슈퍼관리자 전용입니다",
    readOnlyDescription:
      "일반 회원은 공개된 ECC 회원 현황과 활동 내용을 확인할 수 있습니다. 붙여넣기, 조 편성, 공지문 생성은 슈퍼관리자로 로그인한 경우에만 표시됩니다.",
    checkingRole: "권한을 확인하는 중입니다.",
    memberStatus: "Member status",
    memberStatusTitle: "회원 현황",
    affiliation: "Affiliation",
    gathering: "Gathering",
    mt: "MT",
    note: "Note",
    participation: "회 참여",
    notJoined: "미참여",
    emptyMembersTitle: "아직 회원 현황이 없습니다",
    emptyMembersDescription: "슈퍼관리자로 로그인한 뒤 회원 명단을 붙여넣어 주세요.",
    teamMaker: "Team maker",
    teamMakerTitle: "자동 조 편성",
    teamMakerDescription:
      "이름을 붙여넣거나, 비워두면 현재 선택된 활동 신청자 명단을 기준으로 조를 만듭니다.",
    teamSize: "한 조 인원",
    makeTeams: "Make Teams",
    generatedTeams: "Generated teams",
    generatedTeamsTitle: "조 편성 결과",
    emptyTeams:
      "아직 생성된 조가 없습니다. 슈퍼관리자가 이름을 붙여넣거나 신청자 명단을 불러온 뒤 조를 만들 수 있습니다.",
    teamManualEdit: "조 편성 결과를 직접 수정할 수 있습니다.",
    copyTeams: "조 편성 복사",
    copiedTeams: "조 편성 결과를 클립보드에 복사했습니다.",
    kakaoNotice: "Kakao notice",
    kakaoNoticeTitle: "카카오톡 공지문 자동 생성",
    kakaoNoticeDescription:
      "실제 카카오톡 자동 발송은 카카오 API 권한과 서버 연동이 필요합니다. 현재는 단체방에 바로 붙여넣기 좋은 공지문을 자동 생성합니다.",
    activityTitlePlaceholder: "활동명",
    dateTimePlaceholder: "일시 예: 6월 14일 금요일 18:00",
    locationPlaceholder: "장소",
    preparationPlaceholder: "준비물",
    memoPlaceholder: "추가 안내",
    generateNotice: "Generate Kakao Notice",
    copyButton: "Copy",
    noNotice: "아직 생성된 공지문이 없습니다.",
    copied: "공지문을 클립보드에 복사했습니다.",
    copyFailed: "복사가 막혔습니다. 공지문을 직접 선택해서 복사해 주세요.",
    noTeamsForNotice: "아직 조 편성이 없습니다.",
    noticePrefix: "[ECC 공지]",
    defaultNoticeTitle: "ECC 활동",
    dateLabel: "일시",
    locationLabel: "장소",
    preparationLabel: "준비물",
    teamSection: "조 편성",
    guideSection: "안내",
    toBeAnnounced: "추후 공지",
    none: "없음",
    defaultMemo: "참석이 어려운 경우 미리 알려주세요.",
    confirmLine: "확인한 사람은 카카오톡에 확인 표시 부탁드립니다.",
    teamPrefix: "조"
  },
  en: {
    languageEyebrow: "Language",
    languageTitle: "Language",
    languageDescription:
      "Choose Korean or English. Member status, team grouping, and KakaoTalk-ready notices will follow the selected language.",
    applicationEyebrow: "Applications",
    applicationTitle: "Activity Applications",
    applicationDescription:
      "Choose an activity and submit the form like Google Forms. Applicant counts accumulate by activity.",
    applicantCount: "Total applicants",
    applicationFormTitle: "Application Form",
    kakaoNameLabel: "Name registered on KakaoTalk",
    genderLabel: "Gender",
    genderPlaceholder: "Select gender",
    genderMale: "Male",
    genderFemale: "Female",
    genderOther: "Other",
    genderPreferNot: "Prefer not to say",
    nationalityLabel: "Nationality",
    preferredFoodLabel: "Preferred food",
    requestLabel: "Other requests",
    submitApplication: "Submit Application",
    applicationSubmitted: "Application submitted.",
    applicationLoading: "Loading application data.",
    applicationStorageError:
      "There is a problem connecting to the application storage. Please try again later.",
    applicantListTitle: "Applicant List",
    applicantListDescription:
      "Only the super admin can view applicant lists by activity.",
    paidHeader: "Fee",
    paidLabel: "Paid",
    savePayments: "Save",
    paymentsSaved: "Payment status saved.",
    resetApplicants: "Reset Applicants",
    resetConfirm: "Are you sure you want to reset applicants?",
    resetComplete: "Applicants reset.",
    copyNamesTitle: "Copy-friendly name list",
    copyNamesDescription: "This area lists names line by line so they are easy to drag-select and copy.",
    noApplicants: "No applicants yet.",
    submittedAt: "Submitted at",
    members: "Members",
    registeredMembers: "Registered ECC members",
    totalGathering: "Total gathering attendance",
    totalMt: "Total MT attendance",
    specialEventsTotal: "Special event records",
    memberImport: "Member import",
    importTitle: "Paste Member Status",
    importDescription:
      "Paste rows copied from Excel or Google Sheets. Name, affiliation, gathering, MT, special events, and note columns will become member activity records.",
    sample: "Sample",
    saveMemberStatus: "Save Member Status",
    clear: "Clear",
    readOnly: "Read-only view",
    readOnlyTitle: "Member status editing is for the super admin",
    readOnlyDescription:
      "General members can view the public ECC member status and activity records. Pasting data, making teams, and generating notices appear only for the super admin.",
    checkingRole: "Checking your role.",
    memberStatus: "Member status",
    memberStatusTitle: "Member Status",
    affiliation: "Affiliation",
    gathering: "Gathering",
    mt: "MT",
    note: "Note",
    participation: "time(s)",
    notJoined: "Not joined",
    emptyMembersTitle: "No member status yet",
    emptyMembersDescription: "Log in as the super admin and paste the ECC member list.",
    teamMaker: "Team maker",
    teamMakerTitle: "Automatic Team Grouping",
    teamMakerDescription:
      "Paste names, or leave the box empty to use the applicant list for the currently selected activity.",
    teamSize: "Members per team",
    makeTeams: "Make Teams",
    generatedTeams: "Generated teams",
    generatedTeamsTitle: "Team Results",
    emptyTeams:
      "No teams have been generated yet. The super admin can paste names or use the applicant list, then make teams.",
    teamManualEdit: "You can manually edit the team results.",
    copyTeams: "Copy Teams",
    copiedTeams: "Team results copied to clipboard.",
    kakaoNotice: "Kakao notice",
    kakaoNoticeTitle: "KakaoTalk Notice Generator",
    kakaoNoticeDescription:
      "Real automatic KakaoTalk sending requires Kakao API permission and server integration. For now, this creates a message that can be pasted into a group chat.",
    activityTitlePlaceholder: "Activity title",
    dateTimePlaceholder: "Date/time, e.g. Friday, June 14, 6:00 PM",
    locationPlaceholder: "Location",
    preparationPlaceholder: "Preparation",
    memoPlaceholder: "Additional note",
    generateNotice: "Generate Kakao Notice",
    copyButton: "Copy",
    noNotice: "No notice has been generated yet.",
    copied: "Notice copied to clipboard.",
    copyFailed: "Copy was blocked. Please select and copy the notice manually.",
    noTeamsForNotice: "No teams have been generated yet.",
    noticePrefix: "[ECC Notice]",
    defaultNoticeTitle: "ECC Activity",
    dateLabel: "Date/Time",
    locationLabel: "Location",
    preparationLabel: "Preparation",
    teamSection: "Team Assignment",
    guideSection: "Guide",
    toBeAnnounced: "TBA",
    none: "None",
    defaultMemo: "If you cannot attend, please let us know in advance.",
    confirmLine: "Please react in the KakaoTalk chat after checking this notice.",
    teamPrefix: "Team"
  }
} as const;

function safeNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function splitRow(line: string) {
  if (line.includes("\t")) {
    return line.split("\t");
  }

  if (line.includes(",")) {
    return line.split(",");
  }

  return line.split(/\s{2,}/);
}

function looksLikeHeader(cells: string[]) {
  const joined = cells.map(normalizeHeader).join("|");
  return /이름|name/.test(joined) && /gather|게더|mt|특별|event|소속|affiliation/.test(joined);
}

function findColumn(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function readSpecialEvents(value: string) {
  return value
    .split(/[,/|·]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMembersFromPaste(value: string): EccMember[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const firstCells = splitRow(lines[0]).map((cell) => cell.trim());
  const hasHeader = looksLikeHeader(firstCells);
  const headers = hasHeader ? firstCells.map(normalizeHeader) : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const nameIndex = hasHeader ? findColumn(headers, [/^이름$/, /^name$/, /성명/]) : 0;
  const affiliationIndex = hasHeader
    ? findColumn(headers, [/소속/, /학교/, /학과/, /affiliation/, /university/])
    : 1;
  const gatheringIndex = hasHeader
    ? findColumn(headers, [/gather/, /gether/, /게더/, /정기/, /모임/])
    : 2;
  const mtIndex = hasHeader ? findColumn(headers, [/^mt$/, /엠티/]) : 3;
  const specialIndex = hasHeader ? findColumn(headers, [/특별/, /event/, /special/]) : 4;
  const noteIndex = hasHeader ? findColumn(headers, [/비고/, /note/, /memo/, /메모/]) : 5;

  return dataLines
    .map((line, index) => {
      const cells = splitRow(line).map((cell) => cell.trim());
      const rawName = cells[nameIndex >= 0 ? nameIndex : 0] ?? "";
      const name = rawName.replace(/^[-*\d.\s]+/, "").trim();

      if (!name) {
        return null;
      }

      const fallbackText = cells.join(" ");
      const gatheringMatch = fallbackText.match(/gather\w*\s*(\d+)/i);
      const mtMatch = fallbackText.match(/\bmt\s*(\d+)/i);
      const gatheringText =
        gatheringIndex >= 0 ? cells[gatheringIndex] ?? "" : gatheringMatch?.[0] ?? "";
      const mtText = mtIndex >= 0 ? cells[mtIndex] ?? "" : mtMatch?.[0] ?? "";
      const specialText = specialIndex >= 0 ? cells[specialIndex] ?? "" : "";

      return {
        id: `ecc-member-${Date.now()}-${index}-${name}`,
        name,
        affiliation: affiliationIndex >= 0 ? cells[affiliationIndex] ?? "" : "",
        gatheringCount: safeNumber(gatheringText),
        mtCount: safeNumber(mtText),
        specialEvents: readSpecialEvents(specialText),
        note: noteIndex >= 0 ? cells[noteIndex] ?? "" : "",
        raw: line
      };
    })
    .filter((member): member is EccMember => Boolean(member));
}

function memberScore(member: EccMember) {
  return member.gatheringCount + member.mtCount * 2 + member.specialEvents.length;
}

function teamName(index: number, language: Language) {
  return language === "ko" ? `${index + 1}${copy.ko.teamPrefix}` : `${copy.en.teamPrefix} ${index + 1}`;
}

function makeTeams(members: EccMember[], teamSize: number, language: Language) {
  const size = Math.max(1, teamSize);
  const teamCount = Math.max(1, Math.ceil(members.length / size));
  const teams: EccTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `ecc-team-${index + 1}`,
    name: teamName(index, language),
    members: []
  }));
  const sorted = [...members].sort((a, b) => {
    const scoreDiff = memberScore(b) - memberScore(a);
    return scoreDiff || a.name.localeCompare(b.name);
  });

  sorted.forEach((member, index) => {
    const cycle = index % (teamCount * 2);
    const teamIndex = cycle < teamCount ? cycle : teamCount * 2 - cycle - 1;
    teams[teamIndex]?.members.push(member);
  });

  return teams;
}

function formatTeamName(team: EccTeam, index: number, language: Language) {
  return team.name.match(/^\d+조$/) || team.name.match(/^Team\s+\d+$/i)
    ? teamName(index, language)
    : team.name;
}

function buildTeamText(teams: EccTeam[], language: Language) {
  return teams
    .map(
      (team, index) =>
        `${formatTeamName(team, index, language)}: ${team.members
          .map((member) => member.name)
          .join(", ")}`
    )
    .join("\n");
}

function buildNotice(form: NoticeForm, teamText: string, language: Language) {
  const text = copy[language];
  const teamLines = teamText.trim() ? teamText.trim().split(/\r?\n/) : [text.noTeamsForNotice];

  return [
    `${text.noticePrefix} ${form.title || text.defaultNoticeTitle}`,
    "",
    `${text.dateLabel}: ${form.dateTime || text.toBeAnnounced}`,
    `${text.locationLabel}: ${form.location || text.toBeAnnounced}`,
    `${text.preparationLabel}: ${form.preparation || text.none}`,
    "",
    text.teamSection,
    ...teamLines,
    "",
    text.guideSection,
    form.memo || text.defaultMemo,
    "",
    text.confirmLine
  ].join("\n");
}

function readStoredTeams() {
  try {
    const raw = window.localStorage.getItem(adminStorageKeys.eccActivityTeams);
    return raw ? (JSON.parse(raw) as EccTeam[]) : [];
  } catch {
    return [];
  }
}

function readStoredTeamText() {
  try {
    return window.localStorage.getItem(adminStorageKeys.eccActivityTeamsText) ?? "";
  } catch {
    return "";
  }
}

function readStoredNotice() {
  try {
    return window.localStorage.getItem(adminStorageKeys.eccActivityNotice) ?? "";
  } catch {
    return "";
  }
}

function sameNoticeForm(a: NoticeForm, b: NoticeForm) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatApplicationDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function emptyApplicationCounts(): ApplicationCounts {
  return {
    gathering: 0,
    mt: 0,
    special: 0,
    opening: 0,
    farewell: 0
  };
}

function normalizeApplicationCounts(counts?: Partial<ApplicationCounts>): ApplicationCounts {
  const empty = emptyApplicationCounts();

  return {
    gathering: Number(counts?.gathering ?? empty.gathering),
    mt: Number(counts?.mt ?? empty.mt),
    special: Number(counts?.special ?? empty.special),
    opening: Number(counts?.opening ?? empty.opening),
    farewell: Number(counts?.farewell ?? empty.farewell)
  };
}

export function EccActivityPanel() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const { language: siteLanguage, setLanguage: setSiteLanguage } = useLanguage();
  const [language, setLanguage] = useState<Language>("en");
  const [activeApplicationType, setActiveApplicationType] =
    useState<ApplicationType>("gathering");
  const [applicationForm, setApplicationForm] = useState(initialApplicationForm);
  const [applications, setApplications] = useState<EccApplication[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<ApplicationCounts>(
    emptyApplicationCounts
  );
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationError, setApplicationError] = useState("");
  const [applicationSuccess, setApplicationSuccess] = useState("");
  const [teams, setTeams] = useState<EccTeam[]>([]);
  const [teamText, setTeamText] = useState("");
  const [teamNamePaste, setTeamNamePaste] = useState("");
  const [teamSizeInput, setTeamSizeInput] = useState("4");
  const [noticeForm, setNoticeForm] = useState(initialNoticeForms.en);
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDrafts>({});
  const [paymentMessage, setPaymentMessage] = useState("");

  const text = copy[language];

  useEffect(() => {
    const storedTeams = readStoredTeams();
    const storedTeamText = readStoredTeamText();
    setTeams(storedTeams);
    setTeamText(storedTeamText || buildTeamText(storedTeams, language));
    setNotice(readStoredNotice());
  }, [language]);

  useEffect(() => {
    setLanguage(siteLanguage);
    setNoticeForm((currentNoticeForm) =>
      sameNoticeForm(currentNoticeForm, initialNoticeForms.ko) ||
      sameNoticeForm(currentNoticeForm, initialNoticeForms.en)
        ? initialNoticeForms[siteLanguage]
        : currentNoticeForm
    );
  }, [siteLanguage]);

  useEffect(() => {
    setPaymentDrafts((current) => {
      const next: PaymentDrafts = {};

      applications.forEach((application) => {
        next[application.id] = current[application.id] ?? application.status === "paid";
      });

      return next;
    });
  }, [applications]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const controller = new AbortController();

    const loadApplications = async () => {
      setApplicationsLoading(true);

      try {
        const response = await fetch("/api/ecc/applications", {
          signal: controller.signal
        });
        const data = (await response.json()) as ApplicationsApiResponse;

        if (!response.ok) {
          throw new Error(data.error || text.applicationStorageError);
        }

        setApplicationCounts(normalizeApplicationCounts(data.counts));
        setApplications(Array.isArray(data.applications) ? data.applications : []);
        setApplicationError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setApplicationError(
            error instanceof Error ? error.message : text.applicationStorageError
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setApplicationsLoading(false);
        }
      }
    };

    void loadApplications();

    return () => {
      controller.abort();
    };
  }, [isSuperAdmin, loading, text.applicationStorageError]);

  const selectedApplications = useMemo(
    () => applications.filter((application) => application.type === activeApplicationType),
    [activeApplicationType, applications]
  );

  const activeApplication = applicationTypes.find(
    (application) => application.type === activeApplicationType
  )!;

  const changeLanguage = (nextLanguage: Language) => {
    setSiteLanguage(nextLanguage);
    setLanguage((currentLanguage) => {
      const currentDefaults = initialNoticeForms[currentLanguage];
      const nextDefaults = initialNoticeForms[nextLanguage];

      if (sameNoticeForm(noticeForm, currentDefaults)) {
        setNoticeForm(nextDefaults);
      }

      setNotice("");
      setCopyMessage("");
      window.localStorage.setItem(adminStorageKeys.eccActivityLanguage, nextLanguage);
      window.localStorage.removeItem(adminStorageKeys.eccActivityNotice);
      return nextLanguage;
    });
  };

  const updateApplicationForm = (field: keyof ApplicationForm, value: string) => {
    setApplicationForm((current) => ({ ...current, [field]: value }));
    setApplicationSuccess("");
    setApplicationError("");
  };

  const selectApplicationType = (type: ApplicationType) => {
    setActiveApplicationType(type);
    setApplicationSuccess("");
    setApplicationError("");
  };

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApplicationsLoading(true);
    setApplicationError("");

    try {
      const response = await fetch("/api/ecc/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          activity_id: activeApplicationType,
          activity_title: activeApplication.labels[language].title,
          name: applicationForm.name.trim(),
          gender: applicationForm.gender,
          nationality: applicationForm.nationality.trim(),
          preferred_food: applicationForm.preferredFood.trim(),
          other_requests: applicationForm.otherRequests.trim()
        })
      });
      const data = (await response.json()) as ApplicationsApiResponse;

      if (!response.ok) {
        throw new Error(data.error || text.applicationStorageError);
      }

      setApplicationCounts(normalizeApplicationCounts(data.counts));
      setApplications(Array.isArray(data.applications) ? data.applications : []);
      setApplicationForm(initialApplicationForm);
      setApplicationSuccess(text.applicationSubmitted);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : text.applicationStorageError);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const saveTeams = (nextTeams: EccTeam[]) => {
    const nextTeamText = buildTeamText(nextTeams, language);
    window.localStorage.setItem(adminStorageKeys.eccActivityTeams, JSON.stringify(nextTeams));
    window.localStorage.setItem(adminStorageKeys.eccActivityTeamsText, nextTeamText);
    setTeams(nextTeams);
    setTeamText(nextTeamText);
  };

  const buildTeamsFromCurrentList = () => {
    const pastedMembers = parseMembersFromPaste(teamNamePaste);
    const applicantMembers: EccMember[] = selectedApplications.map((application, index) => ({
      id: application.id,
      name: application.name,
      affiliation: "",
      gatheringCount: 0,
      mtCount: 0,
      specialEvents: [],
      note: "",
      raw: `${index + 1}. ${application.name}`
    }));
    const baseMembers = pastedMembers.length > 0 ? pastedMembers : applicantMembers;

    if (baseMembers.length === 0) {
      saveTeams([]);
      return;
    }

    saveTeams(makeTeams(baseMembers, Number(teamSizeInput) || 1, language));
  };

  const generateNotice = () => {
    const nextNotice = buildNotice(noticeForm, teamText, language);
    setNotice(nextNotice);
    window.localStorage.setItem(adminStorageKeys.eccActivityNotice, nextNotice);
  };

  const copyNotice = async () => {
    if (!notice) {
      return;
    }

    try {
      await navigator.clipboard.writeText(notice);
      setCopyMessage(text.copied);
    } catch {
      setCopyMessage(text.copyFailed);
    }
  };

  const updateNoticeForm = (field: keyof NoticeForm, value: string) => {
    setNoticeForm((current) => ({ ...current, [field]: value }));
  };

  const updateTeamText = (value: string) => {
    setTeamText(value);
    window.localStorage.setItem(adminStorageKeys.eccActivityTeamsText, value);
  };

  const copyTeamText = async () => {
    if (!teamText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(teamText);
      setCopyMessage(text.copiedTeams);
    } catch {
      setCopyMessage(text.copyFailed);
    }
  };

  const updatePaymentDraft = (applicationId: string, paid: boolean) => {
    setPaymentDrafts((current) => ({ ...current, [applicationId]: paid }));
    setPaymentMessage("");
  };

  const saveApplicationPayments = async () => {
    setApplicationsLoading(true);
    setApplicationError("");
    setPaymentMessage("");

    try {
      const response = await fetch("/api/ecc/applications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          payments: Object.fromEntries(
            selectedApplications.map((application) => [
              application.id,
              Boolean(paymentDrafts[application.id])
            ])
          )
        })
      });
      const data = (await response.json()) as ApplicationsApiResponse;

      if (!response.ok) {
        throw new Error(data.error || text.applicationStorageError);
      }

      setApplicationCounts(normalizeApplicationCounts(data.counts));
      setApplications(Array.isArray(data.applications) ? data.applications : []);
      setPaymentMessage(text.paymentsSaved);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : text.applicationStorageError);
    } finally {
      setApplicationsLoading(false);
    }
  };

  const resetApplicants = async () => {
    if (!window.confirm(text.resetConfirm)) {
      return;
    }

    setApplicationsLoading(true);
    setApplicationError("");
    setPaymentMessage("");

    try {
      const response = await fetch(
        `/api/ecc/applications?activity_id=${encodeURIComponent(activeApplicationType)}`,
        {
          method: "DELETE"
        }
      );
      const data = (await response.json()) as ApplicationsApiResponse;

      if (!response.ok) {
        throw new Error(data.error || text.applicationStorageError);
      }

      setApplicationCounts(normalizeApplicationCounts(data.counts));
      setApplications(Array.isArray(data.applications) ? data.applications : []);
      setPaymentDrafts((current) => {
        const next = { ...current };
        selectedApplications.forEach((application) => {
          delete next[application.id];
        });
        return next;
      });
      setPaymentMessage(text.resetComplete);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : text.applicationStorageError);
    } finally {
      setApplicationsLoading(false);
    }
  };

  return (
    <div className="grid gap-8">
      <section className="paper-panel flex flex-wrap items-center justify-between gap-5 p-5 md:p-6">
        <div>
          <p className="text-sm font-semibold uppercase text-brass">{text.languageEyebrow}</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
            {text.languageTitle}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/64">
            {text.languageDescription}
          </p>
        </div>
        <div className="flex border border-ink/12 bg-white/45 p-1">
          {(["ko", "en"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeLanguage(item)}
              className={`min-h-10 px-4 text-sm font-semibold transition ${
                language === item ? "bg-ink text-paper" : "text-ink/66 hover:bg-brass/15"
              }`}
            >
              {item === "ko" ? "한국어" : "English"}
            </button>
          ))}
        </div>
      </section>

      <section className="paper-panel grid gap-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
              <CalendarCheck aria-hidden className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase text-brass">
              {text.applicationEyebrow}
            </p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
              {text.applicationTitle}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
              {text.applicationDescription}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {applicationTypes.map((item) => {
            const selected = activeApplicationType === item.type;

            return (
              <button
                key={item.type}
                type="button"
                onClick={() => selectApplicationType(item.type)}
                aria-pressed={selected}
                className={`paper-panel min-h-44 p-5 text-left transition hover:border-brass hover:bg-white/70 ${
                  selected
                    ? "bg-navy text-paper shadow-lift ring-2 ring-brass ring-offset-2 ring-offset-paper"
                    : ""
                }`}
              >
                <p className={`text-sm font-semibold uppercase ${selected ? "text-brass" : "text-brass"}`}>
                  {text.applicantCount}: {applicationsLoading ? "-" : applicationCounts[item.type]}
                </p>
                <h3 className={`mt-4 font-serif text-3xl font-semibold ${selected ? "text-paper" : "text-ink"}`}>
                  {item.labels[language].title}
                </h3>
                <p className={`mt-3 text-sm leading-7 ${selected ? "text-paper/72" : "text-ink/62"}`}>
                  {item.labels[language].description}
                </p>
              </button>
            );
          })}
        </div>

        <form onSubmit={submitApplication} className="grid gap-4 border border-ink/10 bg-white/50 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-brass">
                {activeApplication.labels[language].title}
              </p>
              <h3 className="mt-2 font-serif text-3xl font-semibold text-ink">
                {text.applicationFormTitle}
              </h3>
            </div>
            {applicationSuccess ? (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-pine">
                <CheckCircle2 aria-hidden className="h-4 w-4" />
                {applicationSuccess}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {text.kakaoNameLabel}
              <input
                required
                className="form-field"
                value={applicationForm.name}
                onChange={(event) => updateApplicationForm("name", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {text.genderLabel}
              <select
                required
                className="form-field"
                value={applicationForm.gender}
                onChange={(event) => updateApplicationForm("gender", event.target.value)}
              >
                <option value="">{text.genderPlaceholder}</option>
                <option>{text.genderMale}</option>
                <option>{text.genderFemale}</option>
                <option>{text.genderOther}</option>
                <option>{text.genderPreferNot}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {text.nationalityLabel}
              <input
                required
                className="form-field"
                value={applicationForm.nationality}
                onChange={(event) => updateApplicationForm("nationality", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink">
              {text.preferredFoodLabel}
              <input
                required
                className="form-field"
                value={applicationForm.preferredFood}
                onChange={(event) => updateApplicationForm("preferredFood", event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink md:col-span-2">
              {text.requestLabel}
              <textarea
                className="form-field min-h-28"
                value={applicationForm.otherRequests}
                onChange={(event) => updateApplicationForm("otherRequests", event.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={applicationsLoading}
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <Save aria-hidden className="h-4 w-4" />
            {text.submitApplication}
          </button>
          {applicationError ? (
            <p className="text-sm font-semibold text-red-700">{applicationError}</p>
          ) : null}
        </form>

        {isSuperAdmin ? (
          <div className="border border-ink/10 bg-white/50 p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase text-brass">
                  {activeApplication.labels[language].title}
                </p>
                <h3 className="mt-2 font-serif text-3xl font-semibold text-ink">
                  {text.applicantListTitle}
                </h3>
                <p className="mt-3 text-sm leading-7 text-ink/62">
                  {text.applicantListDescription}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink/58">
                {text.applicantCount}: {applicationCounts[activeApplicationType]}
              </span>
            </div>

            {applicationsLoading ? (
              <p className="mt-5 text-sm leading-7 text-ink/62">{text.applicationLoading}</p>
            ) : selectedApplications.length > 0 ? (
              <>
                <div className="mt-5 border border-ink/10 bg-white/65 p-4">
                  <p className="text-sm font-semibold text-ink">{text.copyNamesTitle}</p>
                  <p className="mt-1 text-xs leading-6 text-ink/54">{text.copyNamesDescription}</p>
                  <pre className="mt-3 select-text whitespace-pre-wrap border border-ink/8 bg-paper/65 p-3 font-sans text-sm leading-7 text-ink cursor-text">
                    {selectedApplications.map((application) => application.name).join("\n")}
                  </pre>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[920px] select-text border-collapse text-left text-sm">
                    <thead className="bg-white/70 text-xs uppercase text-ink/58">
                      <tr>
                        <th className="border-b border-ink/10 px-4 py-3">{text.paidHeader}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.kakaoNameLabel}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.genderLabel}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.nationalityLabel}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.preferredFoodLabel}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.requestLabel}</th>
                        <th className="border-b border-ink/10 px-4 py-3">{text.submittedAt}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedApplications.map((application) => (
                        <tr key={application.id} className="cursor-text border-b border-ink/8 last:border-b-0">
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-blue-600"
                                checked={Boolean(paymentDrafts[application.id])}
                                onChange={(event) =>
                                  updatePaymentDraft(application.id, event.target.checked)
                                }
                              />
                              {text.paidLabel}
                            </label>
                          </td>
                          <td className="px-4 py-3 font-semibold text-ink">
                            {application.name}
                          </td>
                          <td className="px-4 py-3 text-ink/70">{application.gender}</td>
                          <td className="px-4 py-3 text-ink/70">{application.nationality}</td>
                          <td className="px-4 py-3 text-ink/70">{application.preferredFood}</td>
                          <td className="px-4 py-3 text-ink/62">
                            {application.otherRequests || "-"}
                          </td>
                          <td className="px-4 py-3 text-ink/58">
                            {formatApplicationDate(application.createdAt, language)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm leading-7 text-ink/62">{text.noApplicants}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveApplicationPayments}
                disabled={applicationsLoading || selectedApplications.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save aria-hidden className="h-4 w-4" />
                {text.savePayments}
              </button>
              <button
                type="button"
                onClick={resetApplicants}
                disabled={applicationsLoading || applicationCounts[activeApplicationType] === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-900/20 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                {text.resetApplicants}
              </button>
            </div>
            {paymentMessage ? (
              <p className="mt-3 text-sm font-semibold text-pine">{paymentMessage}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="paper-panel p-6 md:p-8">
          <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
            <Shuffle aria-hidden className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase text-brass">{text.teamMaker}</p>
          <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
            {text.teamMakerTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">{text.teamMakerDescription}</p>

          {isSuperAdmin ? (
            <>
              <textarea
                className="form-field mt-6 min-h-36"
                value={teamNamePaste}
                onChange={(event) => setTeamNamePaste(event.target.value)}
                placeholder={language === "ko" ? "김민수\n이지은\nAlex Kim" : "Alex Kim\nSarah Lee\nMin Park"}
              />
              <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
                {text.teamSize}
                <input
                  className="form-field"
                  inputMode="numeric"
                  value={teamSizeInput}
                  onChange={(event) => setTeamSizeInput(event.target.value.replace(/[^0-9]/g, ""))}
                />
              </label>
              <button
                type="button"
                onClick={buildTeamsFromCurrentList}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <Shuffle aria-hidden className="h-4 w-4" />
                {text.makeTeams}
              </button>
            </>
          ) : null}
        </div>

        <div className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">{text.generatedTeams}</p>
          <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
            {text.generatedTeamsTitle}
          </h2>
          {teamText ? (
            <>
              <p className="mt-4 text-sm leading-7 text-ink/62">{text.teamManualEdit}</p>
              <textarea
                className="form-field mt-5 min-h-72 select-text whitespace-pre-wrap font-mono text-sm"
                value={teamText}
                readOnly={!isSuperAdmin}
                onChange={(event) => updateTeamText(event.target.value)}
              />
              <button
                type="button"
                onClick={copyTeamText}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
              >
                <Copy aria-hidden className="h-4 w-4" />
                {text.copyTeams}
              </button>
            </>
          ) : (
            <p className="mt-6 text-sm leading-7 text-ink/62">{text.emptyTeams}</p>
          )}
        </div>
      </section>

      <section className="paper-panel grid gap-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
              <Megaphone aria-hidden className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase text-brass">{text.kakaoNotice}</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
              {text.kakaoNoticeTitle}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
              {text.kakaoNoticeDescription}
            </p>
          </div>
          <Clipboard aria-hidden className="h-10 w-10 text-brass" />
        </div>

        {isSuperAdmin ? (
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-field"
              placeholder={text.activityTitlePlaceholder}
              value={noticeForm.title}
              onChange={(event) => updateNoticeForm("title", event.target.value)}
            />
            <input
              className="form-field"
              placeholder={text.dateTimePlaceholder}
              value={noticeForm.dateTime}
              onChange={(event) => updateNoticeForm("dateTime", event.target.value)}
            />
            <input
              className="form-field"
              placeholder={text.locationPlaceholder}
              value={noticeForm.location}
              onChange={(event) => updateNoticeForm("location", event.target.value)}
            />
            <input
              className="form-field"
              placeholder={text.preparationPlaceholder}
              value={noticeForm.preparation}
              onChange={(event) => updateNoticeForm("preparation", event.target.value)}
            />
            <textarea
              className="form-field min-h-28 md:col-span-2"
              placeholder={text.memoPlaceholder}
              value={noticeForm.memo}
              onChange={(event) => updateNoticeForm("memo", event.target.value)}
            />
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="button"
                onClick={generateNotice}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <Megaphone aria-hidden className="h-4 w-4" />
                {text.generateNotice}
              </button>
              <button
                type="button"
                onClick={copyNotice}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
              >
                <Copy aria-hidden className="h-4 w-4" />
                {text.copyButton}
              </button>
            </div>
          </div>
        ) : null}

        <textarea
          readOnly
          className="form-field min-h-72 whitespace-pre-wrap"
          value={notice || text.noNotice}
        />
        {copyMessage ? <p className="text-sm font-semibold text-pine">{copyMessage}</p> : null}
      </section>
    </div>
  );
}
