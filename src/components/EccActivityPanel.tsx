"use client";

import {
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

const sampleMemberPaste = `이름\t소속\tGathering\tMT\t특별 이벤트\t비고
김민수\t전북대\t3\t1\t피크닉, 회화의 밤\t신입
이지은\t전북대\t2\t0\t문화교류회\t
Alex Kim\tExchange Student\t4\t1\tMT, Speech Night\t팀장 가능`;

const initialNoticeForm: NoticeForm = {
  title: "ECC 정기 모임",
  dateTime: "",
  location: "",
  preparation: "편한 복장, 개인 음료",
  memo: "늦거나 불참하는 경우 조장에게 미리 알려주세요."
};

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
      const gatheringText =
        gatheringIndex >= 0 ? cells[gatheringIndex] ?? "" : fallbackText.match(/gather\w*\s*(\d+)/i)?.[0] ?? "";
      const mtText = mtIndex >= 0 ? cells[mtIndex] ?? "" : fallbackText.match(/\bmt\s*(\d+)/i)?.[0] ?? "";
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

function makeTeams(members: EccMember[], teamSize: number) {
  const size = Math.max(2, teamSize);
  const teamCount = Math.max(1, Math.ceil(members.length / size));
  const teams: EccTeam[] = Array.from({ length: teamCount }, (_, index) => ({
    id: `ecc-team-${index + 1}`,
    name: `${index + 1}조`,
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

function buildNotice(form: NoticeForm, teams: EccTeam[]) {
  const teamLines = teams.length
    ? teams.map((team) => `${team.name}: ${team.members.map((member) => member.name).join(", ")}`)
    : ["아직 조 편성이 없습니다."];

  return [
    `[ECC 공지] ${form.title || "ECC 활동"}`,
    "",
    `일시: ${form.dateTime || "추후 공지"}`,
    `장소: ${form.location || "추후 공지"}`,
    `준비물: ${form.preparation || "없음"}`,
    "",
    "조 편성",
    ...teamLines,
    "",
    "안내",
    form.memo || "참석이 어려운 경우 미리 알려주세요.",
    "",
    "확인한 사람은 카카오톡에 확인 표시 부탁드립니다."
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

function readStoredNotice() {
  try {
    return window.localStorage.getItem(adminStorageKeys.eccActivityNotice) ?? "";
  } catch {
    return "";
  }
}

export function EccActivityPanel() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [members, setMembers] = useState<EccMember[]>([]);
  const [teams, setTeams] = useState<EccTeam[]>([]);
  const [memberPaste, setMemberPaste] = useState(sampleMemberPaste);
  const [teamNamePaste, setTeamNamePaste] = useState("");
  const [teamSize, setTeamSize] = useState(4);
  const [noticeForm, setNoticeForm] = useState(initialNoticeForm);
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    const storedMembers = readStoredMembers();
    const storedTeams = readStoredTeams();
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
    saveTeams(makeTeams(baseMembers, teamSize));
  };

  const generateNotice = () => {
    const nextNotice = buildNotice(noticeForm, teams);
    setNotice(nextNotice);
    window.localStorage.setItem(adminStorageKeys.eccActivityNotice, nextNotice);
  };

  const copyNotice = async () => {
    if (!notice) {
      return;
    }

    try {
      await navigator.clipboard.writeText(notice);
      setCopyMessage("공지문을 클립보드에 복사했습니다.");
    } catch {
      setCopyMessage("복사가 막혔습니다. 공지문을 직접 선택해서 복사해 주세요.");
    }
  };

  const updateNoticeForm = (field: keyof NoticeForm, value: string) => {
    setNoticeForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="grid gap-8">
      <section className="grid gap-5 md:grid-cols-4">
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">Members</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">{summary.members}</p>
          <p className="mt-2 text-xs text-ink/56">등록된 ECC 회원</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">Gathering</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">
            {summary.totalGathering}
          </p>
          <p className="mt-2 text-xs text-ink/56">전체 gathering 참여 합계</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">MT</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">{summary.totalMt}</p>
          <p className="mt-2 text-xs text-ink/56">전체 MT 참여 합계</p>
        </div>
        <div className="paper-panel p-5">
          <p className="text-xs font-semibold uppercase text-ink/55">Special events</p>
          <p className="mt-2 font-serif text-4xl font-semibold text-ink">
            {summary.totalSpecial}
          </p>
          <p className="mt-2 text-xs text-ink/56">특별 이벤트 기록 수</p>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="paper-panel grid gap-5 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
                <FileSpreadsheet aria-hidden className="h-5 w-5" />
              </div>
              <p className="mt-5 text-sm font-semibold uppercase text-brass">Member import</p>
              <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
                회원 현황 붙여넣기
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
                엑셀이나 구글시트에서 이름, 소속, gathering, MT, 특별 이벤트, 비고 열을
                복사해 붙여넣으면 회원별 활동 현황 표로 바뀝니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMemberPaste(sampleMemberPaste)}
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
            >
              <RefreshCcw aria-hidden className="h-4 w-4" />
              Sample
            </button>
          </div>

          <textarea
            className="form-field min-h-56"
            value={memberPaste}
            onChange={(event) => setMemberPaste(event.target.value)}
            placeholder={sampleMemberPaste}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={importMembers}
              className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <Save aria-hidden className="h-4 w-4" />
              Save Member Status
            </button>
            <button
              type="button"
              onClick={clearMembers}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-900/20 px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Clear
            </button>
          </div>
        </section>
      ) : (
        <section className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">Read-only view</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">
            회원 현황 입력은 슈퍼관리자 전용입니다
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">
            일반 회원은 공개된 ECC 회원 현황과 활동 내용을 확인할 수 있습니다. 붙여넣기,
            조 편성, 공지문 생성은 슈퍼관리자로 로그인한 경우에만 표시됩니다.
          </p>
        </section>
      )}

      <section className="paper-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 p-6">
          <div>
            <p className="text-sm font-semibold uppercase text-brass">Member status</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">회원 현황</h2>
          </div>
          <span className="text-sm text-ink/56">{members.length} members</span>
        </div>

        {members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-white/50 text-xs uppercase text-ink/58">
                <tr>
                  <th className="border-b border-ink/10 px-5 py-4">Name</th>
                  <th className="border-b border-ink/10 px-5 py-4">Affiliation</th>
                  <th className="border-b border-ink/10 px-5 py-4">Gathering</th>
                  <th className="border-b border-ink/10 px-5 py-4">MT</th>
                  <th className="border-b border-ink/10 px-5 py-4">Special events</th>
                  <th className="border-b border-ink/10 px-5 py-4">Note</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-ink/8 last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-ink">{member.name}</td>
                    <td className="px-5 py-4 text-ink/64">{member.affiliation || "-"}</td>
                    <td className="px-5 py-4 text-ink/72">{member.gatheringCount}회 참여</td>
                    <td className="px-5 py-4 text-ink/72">
                      {member.mtCount > 0 ? `${member.mtCount}회 참여` : "미참여"}
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
              <p className="mt-4 text-lg font-semibold text-ink">아직 회원 현황이 없습니다</p>
              <p className="mt-2 text-sm text-ink/60">
                슈퍼관리자로 로그인한 뒤 회원 명단을 붙여넣어 주세요.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="paper-panel p-6 md:p-8">
          <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
            <Shuffle aria-hidden className="h-5 w-5" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase text-brass">Team maker</p>
          <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">자동 조 편성</h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">
            이름만 붙여넣거나, 비워두면 저장된 회원 현황을 기준으로 참여 횟수를 고르게
            섞어 조를 만듭니다.
          </p>

          {isSuperAdmin ? (
            <>
              <textarea
                className="form-field mt-6 min-h-36"
                value={teamNamePaste}
                onChange={(event) => setTeamNamePaste(event.target.value)}
                placeholder={"김민수\n이지은\nAlex Kim"}
              />
              <label className="mt-4 grid gap-2 text-sm font-semibold text-ink">
                한 조 인원
                <input
                  className="form-field"
                  inputMode="numeric"
                  value={teamSize}
                  onChange={(event) => setTeamSize(Number(event.target.value.replace(/[^0-9]/g, "")) || 2)}
                />
              </label>
              <button
                type="button"
                onClick={buildTeamsFromCurrentList}
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy"
              >
                <Shuffle aria-hidden className="h-4 w-4" />
                Make Teams
              </button>
            </>
          ) : null}
        </div>

        <div className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">Generated teams</p>
          <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">조 편성 결과</h2>
          {teams.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {teams.map((team) => (
                <article key={team.id} className="border border-ink/10 bg-white/55 p-4">
                  <p className="font-serif text-2xl font-semibold text-ink">{team.name}</p>
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
            <p className="mt-6 text-sm leading-7 text-ink/62">
              아직 생성된 조가 없습니다. 슈퍼관리자가 이름을 붙여넣거나 회원 현황을 저장한 뒤
              조를 만들 수 있습니다.
            </p>
          )}
        </div>
      </section>

      <section className="paper-panel grid gap-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex h-11 w-11 items-center justify-center bg-navy text-paper">
              <Megaphone aria-hidden className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase text-brass">Kakao notice</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">
              카카오톡 공지문 자동 생성
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/64">
              실제 카카오톡 자동 발송은 카카오 API 권한과 서버 연동이 필요합니다. 현재는
              단체방에 바로 붙여넣기 좋은 공지문을 자동 생성합니다.
            </p>
          </div>
          <Clipboard aria-hidden className="h-10 w-10 text-brass" />
        </div>

        {isSuperAdmin ? (
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="form-field"
              placeholder="활동명"
              value={noticeForm.title}
              onChange={(event) => updateNoticeForm("title", event.target.value)}
            />
            <input
              className="form-field"
              placeholder="일시 예: 6월 14일 금요일 18:00"
              value={noticeForm.dateTime}
              onChange={(event) => updateNoticeForm("dateTime", event.target.value)}
            />
            <input
              className="form-field"
              placeholder="장소"
              value={noticeForm.location}
              onChange={(event) => updateNoticeForm("location", event.target.value)}
            />
            <input
              className="form-field"
              placeholder="준비물"
              value={noticeForm.preparation}
              onChange={(event) => updateNoticeForm("preparation", event.target.value)}
            />
            <textarea
              className="form-field min-h-28 md:col-span-2"
              placeholder="추가 안내"
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
                Generate Kakao Notice
              </button>
              <button
                type="button"
                onClick={copyNotice}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-ink/15 px-5 text-sm font-semibold text-ink transition hover:border-brass hover:bg-brass/10"
              >
                <Copy aria-hidden className="h-4 w-4" />
                Copy
              </button>
            </div>
          </div>
        ) : null}

        <textarea
          readOnly
          className="form-field min-h-72 whitespace-pre-wrap"
          value={notice || "아직 생성된 공지문이 없습니다."}
        />
        {copyMessage ? <p className="text-sm font-semibold text-pine">{copyMessage}</p> : null}
      </section>
    </div>
  );
}
