"use client";

import {
  CalendarCheck,
  CheckCircle2,
  Clipboard,
  Copy,
  FileSpreadsheet,
  Megaphone,
  RefreshCcw,
  Save,
  Shuffle,
  Trash2,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { adminStorageKeys } from "@/lib/adminStorageKeys";

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

type ApplicationType = "gathering" | "mt" | "special";

type ApplicationForm = {
  kakaoName: string;
  gender: string;
  nationality: string;
  preferredFood: string;
  request: string;
};

type EccApplication = ApplicationForm & {
  id: string;
  type: ApplicationType;
  createdAt: string;
};

const sampleMemberPasteByLanguage: Record<Language, string> = {
  ko: `이름\t소속\tGathering\tMT\t특별 이벤트\t비고
김민수\t전북대\t3\t1\t피크닉, 회화의 밤\t신입
이지은\t전북대\t2\t0\t문화교류회\t
Alex Kim\tExchange Student\t4\t1\tMT, Speech Night\t팀장 가능`,
  en: `Name\tAffiliation\tGathering\tMT\tSpecial Events\tNote
Alex Kim\tExchange Student\t4\t1\tMT, Speech Night\tCan lead a team
Sarah Lee\tBusiness School\t2\t0\tCulture Night\tNew member
Min Park\tJeonbuk National University\t3\t1\tPicnic, Conversation Night\t`
};

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
  kakaoName: "",
  gender: "",
  nationality: "",
  preferredFood: "",
  request: ""
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
    applicantListTitle: "신청자 명단",
    applicantListDescription:
      "슈퍼관리자로 로그인한 경우에만 활동별 신청자 명단을 확인할 수 있습니다.",
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
      "이름만 붙여넣거나, 비워두면 저장된 회원 현황을 기준으로 참여 횟수를 고르게 섞어 조를 만듭니다.",
    teamSize: "한 조 인원",
    makeTeams: "Make Teams",
    generatedTeams: "Generated teams",
    generatedTeamsTitle: "조 편성 결과",
    emptyTeams:
      "아직 생성된 조가 없습니다. 슈퍼관리자가 이름을 붙여넣거나 회원 현황을 저장한 뒤 조를 만들 수 있습니다.",
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
    applicantListTitle: "Applicant List",
    applicantListDescription:
      "Only the super admin can view applicant lists by activity.",
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
      "Paste names only, or leave the box empty to use the saved member status. The tool balances members by participation records.",
    teamSize: "Members per team",
    makeTeams: "Make Teams",
    generatedTeams: "Generated teams",
    generatedTeamsTitle: "Team Results",
    emptyTeams:
      "No teams have been generated yet. The super admin can paste names or save member status, then make teams.",
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
  const size = Math.max(2, teamSize);
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

function buildNotice(form: NoticeForm, teams: EccTeam[], language: Language) {
  const text = copy[language];
  const teamLines = teams.length
    ? teams.map(
        (team, index) =>
          `${formatTeamName(team, index, language)}: ${team.members
            .map((member) => member.name)
            .join(", ")}`
      )
    : [text.noTeamsForNotice];

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

function readStoredMembers() {
  try {
    const raw = window.localStorage.getItem(adminStorageKeys.eccActivityMembers);
    return raw ? (JSON.parse(raw) as EccMember[]) : [];
  } catch {
    return [];
  }
}

function readStoredTeams() {
  try {
    const raw = window.localStorage.getItem(adminStorageKeys.eccActivityTeams);
    return raw ? (JSON.parse(raw) as EccTeam[]) : [];
  } catch {
    return [];
  }
}

function readStoredApplications() {
  try {
    const raw = window.localStorage.getItem(adminStorageKeys.eccActivityApplications);
    return raw ? (JSON.parse(raw) as EccApplication[]) : [];
  } catch {
    return [];
  }
}

function readStoredNotice() {
  try {
    return window.localStorage.getItem(adminStorageKeys.eccActivityNotice) ?? "";
  } catch {
    return "";
  }
}

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(adminStorageKeys.eccActivityLanguage);
    return stored === "en" ? "en" : "ko";
  } catch {
    return "ko";
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

export function EccActivityPanel() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [language, setLanguage] = useState<Language>("ko");
  const [activeApplicationType, setActiveApplicationType] =
    useState<ApplicationType>("gathering");
  const [applicationForm, setApplicationForm] = useState(initialApplicationForm);
  const [applications, setApplications] = useState<EccApplication[]>([]);
  const [applicationSuccess, setApplicationSuccess] = useState("");
  const [members, setMembers] = useState<EccMember[]>([]);
  const [teams, setTeams] = useState<EccTeam[]>([]);
  const [memberPaste, setMemberPaste] = useState(sampleMemberPasteByLanguage.ko);
  const [teamNamePaste, setTeamNamePaste] = useState("");
  const [teamSize, setTeamSize] = useState(4);
  const [noticeForm, setNoticeForm] = useState(initialNoticeForms.ko);
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const text = copy[language];

  useEffect(() => {
    const storedLanguage = readStoredLanguage();
    const storedMembers = readStoredMembers();
    const storedTeams = readStoredTeams();
    const storedApplications = readStoredApplications();
    setLanguage(storedLanguage);
    setMemberPaste(sampleMemberPasteByLanguage[storedLanguage]);
    setNoticeForm(initialNoticeForms[storedLanguage]);
    setApplications(storedApplications);
    setMembers(storedMembers);
    setTeams(storedTeams);
    setNotice(readStoredNotice());
  }, []);

  const summary = useMemo(() => {
    const totalGathering = members.reduce((total, member) => total + member.gatheringCount, 0);
    const totalMt = members.reduce((total, member) => total + member.mtCount, 0);
    const totalSpecial = members.reduce((total, member) => total + member.specialEvents.length, 0);

    return {
      members: members.length,
      totalGathering,
      totalMt,
      totalSpecial
    };
  }, [members]);

  const applicationCounts = useMemo(
    () =>
      applicationTypes.reduce<Record<ApplicationType, number>>(
        (counts, item) => ({
          ...counts,
          [item.type]: applications.filter((application) => application.type === item.type).length
        }),
        {
          gathering: 0,
          mt: 0,
          special: 0
        }
      ),
    [applications]
  );

  const selectedApplications = useMemo(
    () => applications.filter((application) => application.type === activeApplicationType),
    [activeApplicationType, applications]
  );

  const activeApplication = applicationTypes.find(
    (application) => application.type === activeApplicationType
  )!;

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage((currentLanguage) => {
      const currentSample = sampleMemberPasteByLanguage[currentLanguage];
      const currentDefaults = initialNoticeForms[currentLanguage];
      const nextDefaults = initialNoticeForms[nextLanguage];

      if (memberPaste === currentSample) {
        setMemberPaste(sampleMemberPasteByLanguage[nextLanguage]);
      }

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
  };

  const selectApplicationType = (type: ApplicationType) => {
    setActiveApplicationType(type);
    setApplicationSuccess("");
  };

  const saveApplications = (nextApplications: EccApplication[]) => {
    window.localStorage.setItem(
      adminStorageKeys.eccActivityApplications,
      JSON.stringify(nextApplications)
    );
    setApplications(nextApplications);
  };

  const submitApplication = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextApplication: EccApplication = {
      id: `ecc-application-${Date.now()}`,
      type: activeApplicationType,
      kakaoName: applicationForm.kakaoName.trim(),
      gender: applicationForm.gender,
      nationality: applicationForm.nationality.trim(),
      preferredFood: applicationForm.preferredFood.trim(),
      request: applicationForm.request.trim(),
      createdAt: new Date().toISOString()
    };
    saveApplications([nextApplication, ...applications]);
    setApplicationForm(initialApplicationForm);
    setApplicationSuccess(text.applicationSubmitted);
  };

  const saveMembers = (nextMembers: EccMember[]) => {
    window.localStorage.setItem(adminStorageKeys.eccActivityMembers, JSON.stringify(nextMembers));
    setMembers(nextMembers);
  };

  const saveTeams = (nextTeams: EccTeam[]) => {
    window.localStorage.setItem(adminStorageKeys.eccActivityTeams, JSON.stringify(nextTeams));
    setTeams(nextTeams);
  };

  const importMembers = () => {
    const parsed = parseMembersFromPaste(memberPaste);
    saveMembers(parsed);
    saveTeams([]);
    setNotice("");
    window.localStorage.removeItem(adminStorageKeys.eccActivityNotice);
  };

  const clearMembers = () => {
    saveMembers([]);
    saveTeams([]);
    setNotice("");
    window.localStorage.removeItem(adminStorageKeys.eccActivityNotice);
  };

  const buildTeamsFromCurrentList = () => {
    const pastedMembers = parseMembersFromPaste(teamNamePaste);
    const baseMembers = pastedMembers.length > 0 ? pastedMembers : members;
    saveTeams(makeTeams(baseMembers, teamSize, language));
  };

  const generateNotice = () => {
    const nextNotice = buildNotice(noticeForm, teams, language);
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

        <div className="grid gap-4 lg:grid-cols-3">
          {applicationTypes.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => selectApplicationType(item.type)}
              className={`paper-panel min-h-44 p-5 text-left transition hover:border-brass hover:bg-white/70 ${
                activeApplicationType === item.type ? "border-brass bg-white/75 shadow-soft" : ""
              }`}
            >
              <p className="text-sm font-semibold uppercase text-brass">
                {text.applicantCount}: {applicationCounts[item.type]}
              </p>
              <h3 className="mt-4 font-serif text-3xl font-semibold text-ink">
                {item.labels[language].title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink/62">
                {item.labels[language].description}
              </p>
            </button>
          ))}
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
                value={applicationForm.kakaoName}
                onChange={(event) => updateApplicationForm("kakaoName", event.target.value)}
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
                value={applicationForm.request}
                onChange={(event) => updateApplicationForm("request", event.target.value)}
              />
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <Save aria-hidden className="h-4 w-4" />
            {text.submitApplication}
          </button>
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
                {text.applicantCount}: {selectedApplications.length}
              </span>
            </div>

            {selectedApplications.length > 0 ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead className="bg-white/70 text-xs uppercase text-ink/58">
                    <tr>
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
                      <tr key={application.id} className="border-b border-ink/8 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-ink">
                          {application.kakaoName}
                        </td>
                        <td className="px-4 py-3 text-ink/70">{application.gender}</td>
                        <td className="px-4 py-3 text-ink/70">{application.nationality}</td>
                        <td className="px-4 py-3 text-ink/70">{application.preferredFood}</td>
                        <td className="px-4 py-3 text-ink/62">{application.request || "-"}</td>
                        <td className="px-4 py-3 text-ink/58">
                          {formatApplicationDate(application.createdAt, language)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-7 text-ink/62">{text.noApplicants}</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">{text.members}</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">{summary.members}</p>
          <p className="mt-2 text-xs text-ink/56">{text.registeredMembers}</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">{text.gathering}</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">
            {summary.totalGathering}
          </p>
          <p className="mt-2 text-xs text-ink/56">{text.totalGathering}</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">{text.mt}</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">{summary.totalMt}</p>
          <p className="mt-2 text-xs text-ink/56">{text.totalMt}</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">Special events</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">
            {summary.totalSpecial}
          </p>
          <p className="mt-2 text-xs text-ink/56">{text.specialEventsTotal}</p>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="paper-panel grid gap-5 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
                <FileSpreadsheet aria-hidden className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm font-semibold uppercase text-brass">
                {text.memberImport}
              </p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
                {text.importTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
                {text.importDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMemberPaste(sampleMemberPasteByLanguage[language])}
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
            >
              <RefreshCcw aria-hidden className="h-4 w-4" />
              {text.sample}
            </button>
          </div>

          <textarea
            className="form-field min-h-56"
            value={memberPaste}
            onChange={(event) => setMemberPaste(event.target.value)}
            placeholder={sampleMemberPasteByLanguage[language]}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={importMembers}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <Save aria-hidden className="h-4 w-4" />
              {text.saveMemberStatus}
            </button>
            <button
              type="button"
              onClick={clearMembers}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-900/20 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              {text.clear}
            </button>
          </div>
        </section>
      ) : (
        <section className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">{text.readOnly}</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
            {loading ? text.checkingRole : text.readOnlyTitle}
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">{text.readOnlyDescription}</p>
        </section>
      )}

      <section className="paper-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 p-6">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">{text.memberStatus}</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
              {text.memberStatusTitle}
            </h2>
          </div>
          <span className="text-sm text-ink/56">
            {members.length} {text.members.toLowerCase()}
          </span>
        </div>

        {members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-white/50 text-xs uppercase text-ink/58">
                <tr>
                  <th className="border-b border-ink/10 px-5 py-4">Name</th>
                  <th className="border-b border-ink/10 px-5 py-4">{text.affiliation}</th>
                  <th className="border-b border-ink/10 px-5 py-4">{text.gathering}</th>
                  <th className="border-b border-ink/10 px-5 py-4">{text.mt}</th>
                  <th className="border-b border-ink/10 px-5 py-4">Special events</th>
                  <th className="border-b border-ink/10 px-5 py-4">{text.note}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-ink/8 last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-ink">{member.name}</td>
                    <td className="px-5 py-4 text-ink/64">{member.affiliation || "-"}</td>
                    <td className="px-5 py-4 text-ink/72">
                      {member.gatheringCount} {text.participation}
                    </td>
                    <td className="px-5 py-4 text-ink/72">
                      {member.mtCount > 0
                        ? `${member.mtCount} ${text.participation}`
                        : text.notJoined}
                    </td>
                    <td className="px-5 py-4 text-ink/72">
                      {member.specialEvents.length > 0 ? member.specialEvents.join(", ") : "-"}
                    </td>
                    <td className="px-5 py-4 text-ink/62">{member.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center p-8 text-center">
            <div>
              <Users aria-hidden className="mx-auto h-10 w-10 text-brass" />
              <p className="mt-4 text-lg font-semibold text-ink">{text.emptyMembersTitle}</p>
              <p className="mt-2 text-sm text-ink/60">{text.emptyMembersDescription}</p>
            </div>
          </div>
        )}
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
                  value={teamSize}
                  onChange={(event) =>
                    setTeamSize(Number(event.target.value.replace(/[^0-9]/g, "")) || 2)
                  }
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
          {teams.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {teams.map((team, index) => (
                <article key={team.id} className="border border-ink/10 bg-white/55 p-4">
                  <p className="font-serif text-2xl font-semibold text-ink">
                    {formatTeamName(team, index, language)}
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-ink/70">
                    {team.members.map((member) => (
                      <li key={`${team.id}-${member.id}`}>
                        {member.name}
                        <span className="ml-2 text-xs text-ink/46">
                          G {member.gatheringCount} / MT {member.mtCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
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
