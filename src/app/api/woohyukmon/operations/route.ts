import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { cleanText } from "@/lib/supabaseServer";
import {
  activityApplicantRows,
  activityGenderStats,
  findActivityFromText,
  prepareActivityMutation,
  executeActivityMutation
} from "@/lib/woohyukmon/operations/activities";
import {
  findMembers,
  getGenderStatistics,
  getMemberDetails,
  getMemberStatistics,
  getNationalityStatistics,
  listMembers,
  memberCandidate,
  prepareMemberMutation,
  executeMemberMutation
} from "@/lib/woohyukmon/operations/members";
import {
  isKoreanNationality,
  normalizeNationality
} from "@/lib/woohyukmon/operations/nationality";
import { isRegisteredWriteTool } from "@/lib/woohyukmon/operations/registry";
import {
  createWoohyukmonConfirmationToken,
  verifyWoohyukmonConfirmationToken
} from "@/lib/woohyukmon/operations/token";
import type {
  WoohyukmonConfirmationPayload,
  WoohyukmonOperationResponse,
  WoohyukmonOperationTool
} from "@/lib/woohyukmon/operations/types";

export const dynamic = "force-dynamic";

type RequestBody = {
  action?: unknown;
  message?: unknown;
  token?: unknown;
  selectedTargetId?: unknown;
  contextTargetId?: unknown;
  contextTargetIds?: unknown;
};

function json(payload: WoohyukmonOperationResponse, status = 200) {
  return NextResponse.json(payload, { status });
}

function detectNationality(message: string) {
  const value = message.normalize("NFKC").toLowerCase();
  const aliases: Array<[RegExp, string]> = [
    [/(?:러시아|russia|russian)/i, "Russia"],
    [/(?:카자흐|kazakh|kazakhstan|kazakhtstan)/i, "Kazakhstan"],
    [/(?:말레이시아|malaysia|malaysian)/i, "Malaysia"],
    [/(?:몰도바|moldova|moldovan)/i, "Moldova"],
    [/(?:중국|china|chinese)/i, "China"],
    [/(?:일본|japan|japanese)/i, "Japan"],
    [/(?:베트남|vietnam|vietnamese)/i, "Vietnam"],
    [/(?:몽골|mongolia|mongolian)/i, "Mongolia"],
    [/(?:우즈베키스탄|uzbekistan|uzbek)/i, "Uzbekistan"],
    [/(?:키르기스스탄|kyrgyzstan|kyrgyz)/i, "Kyrgyzstan"],
    [/(?:대한민국|한국인|south korea|korean)/i, "South Korea"]
  ];

  for (const [pattern, nationality] of aliases) {
    if (pattern.test(value)) return nationality;
  }

  return "";
}

function isListRequest(message: string) {
  return /명단|보여|목록|누구|학생들|회원들|list|show/i.test(message);
}

function isCountRequest(message: string) {
  return /몇\s*명|몇명|count|how many|현황|통계/i.test(message);
}

function isForeignRequest(message: string) {
  return /외국인|foreign|international/i.test(message);
}

function isFemaleRequest(message: string) {
  return /여자|여성|female|woman|women/i.test(message);
}

function isMaleRequest(message: string) {
  return /남자|남성|male|man|men/i.test(message);
}

function extractMemberName(message: string) {
  const normalized = message
    .replace(/[?!.。！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /^(.+?)\s*(?:회원(?:의|은|이|을|를)?\s*)?(?:회비|정회원|관리자\s*메모|메모|찾아|검색|상태)/i,
    /^(?:회원\s*)?(.+?)\s*(?:찾아|검색)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]
      ?.replace(/^(?:현재|혹시)\s+/i, "")
      .replace(/\s*(?:님|회원)$/i, "")
      .trim();

    if (
      candidate &&
      !/^(?:이|그|저|현재|회원|외국인|한국인|미납자|납부자)$/i.test(candidate)
    ) {
      return candidate.slice(0, 120);
    }
  }

  return "";
}

function extractAdminNote(message: string) {
  const korean = message.match(
    /(?:관리자\s*)?메모(?:에|로)?\s*["“']?(.+?)["”']?\s*(?:라고\s*)?(?:적어|써|추가|저장)/i
  );
  if (korean?.[1]) return korean[1].trim().slice(0, 1000);

  const english = message.match(/(?:add|write)\s+(.+?)\s+(?:to|in)\s+(?:the\s+)?admin\s+note/i);
  return english?.[1]?.trim().slice(0, 1000) || "";
}

function detectWriteTool(message: string): WoohyukmonOperationTool | null {
  if (/(?:관리자\s*)?메모(?:에|로)?.*(?:적어|써|추가|저장)|admin\s+note/i.test(message)) {
    return "append_member_admin_note";
  }

  if (/정회원.*(?:해제|취소|철회)|revoke.*official|remove.*official/i.test(message)) {
    return "revoke_official_member";
  }

  if (/정회원.*승인|official.*(?:approve|confirm)/i.test(message)) {
    return "approve_official_member";
  }

  if (
    /(?:미납으로|미납\s*처리|납부\s*(?:취소|해제)|회비.*(?:미납|취소).*처리)|mark.*unpaid|unconfirm.*payment/i.test(
      message
    )
  ) {
    return "mark_payment_unconfirmed";
  }

  if (
    /회비\s*(?:납부\s*)?(?:처리|확인)(?:\s*(?:해|해줘|해주세요|줘|부탁))?|납부.*(?:처리|확인)(?:\s*(?:해|해줘|해주세요|줘))?|mark.*paid|confirm.*payment/i.test(
      message
    )
  ) {
    return "mark_payment_confirmed";
  }

  if (
    /(?:신청|모집).*(?:닫|마감|종료)|(?:닫|마감|종료).*(?:신청|모집)|close.*applications?/i.test(
      message
    )
  ) {
    return "close_activity_applications";
  }

  if (
    /(?:신청|모집).*(?:열|오픈|시작)|(?:열|오픈|시작).*(?:신청|모집)|open.*applications?/i.test(
      message
    )
  ) {
    return "open_activity_applications";
  }

  return null;
}

function confirmationCopy(tool: WoohyukmonOperationTool, count: number) {
  switch (tool) {
    case "mark_payment_confirmed":
      return {
        title: "회비 납부 확인",
        summary: `${count}명의 회비를 납부 확인 처리합니다. 기존 ECC 승인 로직에 따라 정회원 권한도 함께 동기화됩니다.`
      };
    case "mark_payment_unconfirmed":
      return {
        title: "회비 납부 확인 취소",
        summary: `${count}명의 회비 상태를 미납으로 변경합니다. 기존 ECC 로직에 따라 정회원 권한도 함께 해제됩니다.`
      };
    case "approve_official_member":
      return {
        title: "ECC 정회원 승인",
        summary: `${count}명을 정회원으로 승인합니다. 현재 ECC의 회비 확인 기반 승인 로직을 그대로 사용합니다.`
      };
    case "revoke_official_member":
      return {
        title: "ECC 정회원 해제",
        summary: `${count}명의 정회원 승인을 해제합니다. 현재 ECC의 기존 해제 로직을 그대로 사용합니다.`
      };
    case "append_member_admin_note":
      return {
        title: "관리자 메모 추가",
        summary: `${count}명의 관리자 메모에 요청한 내용을 추가합니다.`
      };
    case "open_activity_applications":
      return {
        title: "활동 신청 열기",
        summary: "선택한 활동의 신청을 엽니다."
      };
    case "close_activity_applications":
      return {
        title: "활동 신청 닫기",
        summary: "선택한 활동의 신청을 닫고 현재 활동 기록 마감 로직을 실행합니다."
      };
  }
}

async function resolveMemberTargets(
  message: string,
  body: RequestBody,
  tool: WoohyukmonOperationTool
): Promise<
  | { targetIds: string[] }
  | { response: WoohyukmonOperationResponse }
> {
  const selectedTargetId = cleanText(body.selectedTargetId, 120);
  if (selectedTargetId) {
    const selected = await getMemberDetails(selectedTargetId);
    if (selected) return { targetIds: [selected.id] };
  }

  const contextTargetId = cleanText(body.contextTargetId, 120);
  if (
    contextTargetId &&
    /이\s*회원|이분|그\s*회원|this\s+member/i.test(message)
  ) {
    const selected = await getMemberDetails(contextTargetId);
    if (selected) return { targetIds: [selected.id] };
  }

  const contextTargetIds = Array.isArray(body.contextTargetIds)
    ? body.contextTargetIds.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 50)
    : [];

  if (
    contextTargetIds.length > 0 &&
    /이\s*(?:(?:\d+\s*)?명|사람|회원).*전부|이\s*목록|전부\s*(?:처리|승인)|these\s+members/i.test(
      message
    )
  ) {
    return { targetIds: contextTargetIds };
  }

  if (
    tool === "mark_payment_confirmed" &&
    /미납자.*전부|모든\s*미납|all.*unpaid/i.test(message)
  ) {
    const unpaid = await listMembers({ paid: false }, 50);

    if (unpaid.total > 50) {
      return {
        response: {
          handled: true,
          kind: "answer",
          title: "일괄 처리 범위가 너무 큽니다",
          summary: `현재 미납자는 ${unpaid.total}명입니다. 안전을 위해 한 번에 최대 50명까지 처리할 수 있으므로 대상을 더 좁혀 주세요.`
        }
      };
    }

    return { targetIds: unpaid.members.map((member) => member.id) };
  }

  const name = extractMemberName(message);
  if (!name) {
    return {
      response: {
        handled: true,
        kind: "answer",
        title: "대상 회원이 필요합니다",
        summary: "처리할 회원 이름을 함께 입력해 주세요. 예: “김민지 회비 납부 처리해줘.”"
      }
    };
  }

  const matches = await findMembers(name);

  if (matches.length === 0) {
    return {
      response: {
        handled: true,
        kind: "answer",
        title: "회원을 찾지 못했습니다",
        summary: `“${name}”와 일치하는 ECC 회원을 찾지 못했습니다.`
      }
    };
  }

  if (matches.length > 1) {
    return {
      response: {
        handled: true,
        kind: "candidates",
        title: "동일하거나 유사한 이름의 회원이 여러 명 있습니다",
        summary: "아래에서 정확한 회원을 선택해 주세요.",
        candidates: matches.map(memberCandidate)
      }
    };
  }

  return { targetIds: [matches[0].id] };
}

async function prepareWrite(
  message: string,
  body: RequestBody,
  actorEmail: string,
  actorRole: string,
  tool: WoohyukmonOperationTool
) {
  if (
    tool === "open_activity_applications" ||
    tool === "close_activity_applications"
  ) {
    const activityData = await findActivityFromText(message);

    if (!activityData.activity) {
      return json({
        handled: true,
        kind: "answer",
        title: "활동을 찾지 못했습니다",
        summary: "열거나 닫을 ECC 활동 이름을 함께 입력해 주세요."
      });
    }

    const prepared = await prepareActivityMutation({
      actorEmail,
      actorRole,
      activityId: activityData.activity.id,
      tool
    });

    if (!prepared) {
      return json({
        handled: true,
        kind: "answer",
        title: "활동을 찾지 못했습니다",
        summary: "현재 활동 카탈로그에서 해당 활동을 찾지 못했습니다."
      });
    }

    const currentOpen = prepared.expected[0]?.activityOpen;
    const requestedOpen = tool === "open_activity_applications";

    if (currentOpen === requestedOpen) {
      return json({
        handled: true,
        kind: "answer",
        title: "이미 요청한 상태입니다",
        summary: requestedOpen
          ? "해당 활동의 신청은 이미 열려 있습니다."
          : "해당 활동의 신청은 이미 닫혀 있습니다."
      });
    }

    const payload: WoohyukmonConfirmationPayload = {
      version: 1,
      actorEmail,
      actorRole,
      tool,
      targetIds: prepared.targetIds,
      expected: prepared.expected,
      args: prepared.args,
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    const copy = confirmationCopy(tool, 1);

    return json({
      handled: true,
      kind: "confirmation",
      title: copy.title,
      summary: copy.summary,
      token: createWoohyukmonConfirmationToken(payload),
      tool,
      targetCount: 1,
      rows: prepared.rows
    });
  }

  const resolved = await resolveMemberTargets(message, body, tool);
  if ("response" in resolved) return json(resolved.response);

  if (resolved.targetIds.length === 0) {
    return json({
      handled: true,
      kind: "answer",
      title: "처리 대상이 없습니다",
      summary: "현재 조건에 해당하는 회원이 없습니다."
    });
  }

  const note =
    tool === "append_member_admin_note" ? extractAdminNote(message) : "";

  if (tool === "append_member_admin_note" && !note) {
    return json({
      handled: true,
      kind: "answer",
      title: "메모 내용이 필요합니다",
      summary: "추가할 관리자 메모 내용을 함께 입력해 주세요."
    });
  }

  const prepared = await prepareMemberMutation({
    actorEmail,
    actorRole,
    tool,
    targetIds: resolved.targetIds,
    note
  });

  if (!prepared) {
    return json({
      handled: true,
      kind: "answer",
      title: "대상 회원을 찾지 못했습니다",
      summary: "회원 상태를 다시 확인한 뒤 요청해 주세요."
    });
  }

  if (prepared.targetCount === 0) {
    return json({
      handled: true,
      kind: "answer",
      title: "이미 요청한 상태입니다",
      summary:
        tool === "mark_payment_confirmed" || tool === "approve_official_member"
          ? "선택한 회원은 이미 회비 납부 확인 상태입니다."
          : "선택한 회원은 이미 미납 상태입니다."
    });
  }

  const payload: WoohyukmonConfirmationPayload = {
    version: 1,
    actorEmail,
    actorRole,
    tool,
    targetIds: prepared.targetIds,
    expected: prepared.expected,
    args: prepared.args,
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  const copy = confirmationCopy(tool, prepared.targetCount);
  const summary =
    tool === "append_member_admin_note" && note
      ? `${copy.summary}\n\n추가할 메모: “${note}”`
      : prepared.skippedCount > 0
        ? `${copy.summary}\n이미 같은 상태인 ${prepared.skippedCount}명은 제외했습니다.`
        : copy.summary;

  return json({
    handled: true,
    kind: "confirmation",
    title: copy.title,
    summary,
    token: createWoohyukmonConfirmationToken(payload),
    tool,
    targetCount: prepared.targetCount,
    rows: prepared.rows
  });
}

async function resolveReadMember(
  message: string,
  body: RequestBody
): Promise<WoohyukmonOperationResponse | null> {
  const selectedTargetId = cleanText(body.selectedTargetId, 120);
  if (selectedTargetId) {
    const member = await getMemberDetails(selectedTargetId);

    if (member) {
      return {
        handled: true,
        kind: "answer",
        title: member.fullName,
        rows: [
          {
            이름: member.fullName,
            국적: normalizeNationality(member.nationality),
            학과: member.departmentOrMajor,
            회비: member.paymentConfirmed ? "납부" : "미납",
            정회원: member.officialMember ? "승인" : "미승인"
          }
        ],
        contextTargetId: member.id,
        contextTargetIds: [member.id]
      };
    }
  }

  const contextTargetId = cleanText(body.contextTargetId, 120);
  const name = extractMemberName(message);

  if (
    contextTargetId &&
    /이\s*회원|이분|그\s*회원|this\s+member/i.test(message) &&
    /회비|정회원|상태|paid|official|status/i.test(message)
  ) {
    const member = await getMemberDetails(contextTargetId);
    if (!member) {
      return {
        handled: true,
        kind: "answer",
        title: "회원을 찾지 못했습니다",
        summary: "해당 회원을 다시 검색해 주세요."
      };
    }

    return {
      handled: true,
      kind: "answer",
      title: member.fullName,
      rows: [
        {
          이름: member.fullName,
          국적: normalizeNationality(member.nationality),
          학과: member.departmentOrMajor,
          회비: member.paymentConfirmed ? "납부" : "미납",
          정회원: member.officialMember ? "승인" : "미승인"
        }
      ],
      contextTargetId: member.id,
      contextTargetIds: [member.id]
    };
  }

  if (
    name &&
    /찾아|검색|회비|정회원|상태|paid|official|status|find|search/i.test(message)
  ) {
    const matches = await findMembers(name);

    if (matches.length === 0) {
      return {
        handled: true,
        kind: "answer",
        title: "회원을 찾지 못했습니다",
        summary: `“${name}”와 일치하는 ECC 회원을 찾지 못했습니다.`
      };
    }

    if (matches.length > 1) {
      return {
        handled: true,
        kind: "candidates",
        title: "동일하거나 유사한 이름의 회원이 여러 명 있습니다",
        summary: "확인할 회원을 선택해 주세요.",
        candidates: matches.map(memberCandidate)
      };
    }

    const member = matches[0];
    return {
      handled: true,
      kind: "answer",
      title: member.fullName,
      rows: [
        {
          이름: member.fullName,
          국적: normalizeNationality(member.nationality),
          학과: member.departmentOrMajor,
          회비: member.paymentConfirmed ? "납부" : "미납",
          정회원: member.officialMember ? "승인" : "미승인"
        }
      ],
      contextTargetId: member.id,
      contextTargetIds: [member.id]
    };
  }

  if (
    /한국인.*외국인|외국인.*한국인|korean.*foreign|foreign.*korean/i.test(message) &&
    /몇\s*명|몇명|각각|비교|현황|count|how many/i.test(message)
  ) {
    const stats = await getMemberStatistics();
    return {
      handled: true,
      kind: "answer",
      title: "ECC 한국인·외국인 현황",
      rows: [
        {
          한국인: stats.korean,
          외국인: stats.foreign,
          전체: stats.total
        }
      ]
    };
  }

  const nationality = detectNationality(message);
  const foreignOnly = isForeignRequest(message);
  const gender: "Male" | "Female" | undefined = isFemaleRequest(message)
    ? "Female"
    : isMaleRequest(message)
      ? "Male"
      : undefined;

  if (/국적별|nationalit(?:y|ies).*(?:통계|현황|breakdown)|국가별/i.test(message)) {
    const stats = await getNationalityStatistics(foreignOnly);
    return {
      handled: true,
      kind: "answer",
      title: foreignOnly ? "ECC 외국인 국적별 현황" : "ECC 국적별 현황",
      rows: stats.map((item) => ({ 국적: item.nationality, 인원: item.count }))
    };
  }

  if (/성비|gender.*(?:ratio|stat|breakdown)|남녀.*비율/i.test(message)) {
    const stats = await getGenderStatistics({
      foreignOnly,
      nationality: nationality || undefined
    });
    return {
      handled: true,
      kind: "answer",
      title: foreignOnly ? "ECC 외국인 성비" : "ECC 성비",
      rows: stats.map((item) => ({ 성별: item.gender, 인원: item.count }))
    };
  }

  if (
    foreignOnly &&
    gender &&
    /몇\s*명|몇명|count|how many/i.test(message)
  ) {
    const result = await listMembers({ foreignOnly: true, gender }, 50);
    return {
      handled: true,
      kind: "answer",
      title: `ECC 외국인 ${gender === "Female" ? "여성" : "남성"} 회원`,
      summary: `총 ${result.total}명입니다.`,
      rows: isListRequest(message) ? result.rows : undefined,
      contextTargetIds: result.members.slice(0, 50).map((member) => member.id)
    };
  }

  if (
    /회비.*(?:현황|통계)|(?:payment|fee).*(?:summary|statistics|status)/i.test(message) &&
    !/처리|확인.*(?:해|줘)|mark|confirm/i.test(message)
  ) {
    const stats = await getMemberStatistics();
    return {
      handled: true,
      kind: "answer",
      title: "ECC 회비 현황",
      rows: [
        {
          전체: stats.total,
          납부: stats.paid,
          미납: stats.unpaid
        }
      ]
    };
  }

  if (
    /(?:전체|전부|모든).*회원.*(?:보여|목록|명단)|회원.*(?:전체|전부|모든).*(?:보여|목록|명단)|all.*members/i.test(
      message
    )
  ) {
    const result = await listMembers({}, 50);
    return {
      handled: true,
      kind: "answer",
      title: "ECC 회원 목록",
      summary:
        result.total > 50
          ? `전체 ${result.total}명 중 화면에는 최대 50명까지 표시합니다.`
          : `총 ${result.total}명입니다.`,
      rows: result.rows,
      contextTargetIds: result.members.slice(0, 50).map((member) => member.id)
    };
  }

  const asksUnpaid = /미납|unpaid/i.test(message);
  const asksPaid = !asksUnpaid && /납부자|회비.*납부|paid members?|payment.*confirmed/i.test(message);
  const asksPending = /승인\s*대기|미승인|pending.*(?:member|approval)/i.test(message);
  const asksOfficial = /정회원.*(?:명단|목록|몇\s*명|몇명)|official members?/i.test(message);

  if (asksUnpaid || asksPaid || asksPending || asksOfficial || nationality) {
    const filter = {
      paid: asksUnpaid ? false : asksPaid ? true : undefined,
      pending: asksPending || undefined,
      official: asksOfficial ? true : undefined,
      nationality: nationality || undefined,
      foreignOnly: foreignOnly || undefined,
      gender
    };
    const result = await listMembers(filter, 50);
    const condition = asksUnpaid
      ? "미납"
      : asksPaid
        ? "회비 납부"
        : asksPending
          ? "승인 대기"
          : asksOfficial
            ? "정회원"
            : nationality || "조건 일치";

    return {
      handled: true,
      kind: "answer",
      title: `ECC ${condition} 회원`,
      summary: `총 ${result.total}명입니다.`,
      rows: isListRequest(message) ? result.rows : undefined,
      contextTargetIds: result.members.slice(0, 50).map((member) => member.id)
    };
  }

  if (
    /(?:ecc\s*)?(?:총\s*)?회원.*(?:몇\s*명|몇명|현황|통계|수)|현재.*ecc.*회원|member.*(?:count|summary|statistics)/i.test(
      message
    )
  ) {
    const stats = await getMemberStatistics();
    return {
      handled: true,
      kind: "answer",
      title: "ECC 회원 현황",
      rows: [
        {
          전체: stats.total,
          납부: stats.paid,
          미납: stats.unpaid,
          정회원: stats.official,
          승인대기: stats.pending,
          한국인: stats.korean,
          외국인: stats.foreign
        }
      ]
    };
  }

  return null;
}

async function resolveReadActivity(
  message: string
): Promise<WoohyukmonOperationResponse | null> {
  if (
    !/gathering|게더링|\bmt\b|엠티|개강총회|종강총회|special|특별\s*이벤트|english\s*class|영어\s*수업|신청자|모집\s*중|열려\s*있는\s*활동|행사/i.test(
      message
    )
  ) {
    return null;
  }

  const data = await findActivityFromText(message);

  if (/현재.*(?:모집|신청).*(?:중|열)|모집\s*중인\s*(?:행사|활동)|open.*activities/i.test(message)) {
    return {
      handled: true,
      kind: "answer",
      title: "현재 모집 중인 ECC 활동",
      rows: data.rows.filter((row) => row.상태 === "모집 중")
    };
  }

  if (!data.activity) {
    return {
      handled: true,
      kind: "answer",
      title: "ECC 활동 현황",
      rows: data.rows
    };
  }

  const activityId = data.activity.id;
  const title = data.activity.titleKo || data.activity.titleEn;
  const applicant = activityApplicantRows(data.applications, activityId, 50);

  if (isForeignRequest(message)) {
    const foreign = applicant.applications.filter(
      (application) => !isKoreanNationality(application.nationality ?? "")
    );
    return {
      handled: true,
      kind: "answer",
      title: `${title} 외국인 신청 현황`,
      summary: `외국인 신청자는 ${foreign.length}명입니다.`,
      rows: isListRequest(message)
        ? foreign.slice(0, 50).map((application) => ({
            이름: application.name,
            국적: normalizeNationality(application.nationality ?? ""),
            성별: application.gender || ""
          }))
        : undefined
    };
  }

  const nationality = detectNationality(message);
  if (nationality) {
    const count = applicant.applications.filter(
      (application) =>
        normalizeNationality(application.nationality ?? "") === nationality
    ).length;
    return {
      handled: true,
      kind: "answer",
      title: `${title} · ${nationality}`,
      summary: `신청자는 ${count}명입니다.`
    };
  }

  if (/성비|gender/i.test(message)) {
    const stats = activityGenderStats(data.applications, activityId);
    return {
      handled: true,
      kind: "answer",
      title: `${title} 신청자 성비`,
      rows: stats.map((item) => ({ 성별: item.gender, 인원: item.count }))
    };
  }

  if (/신청자|신청\s*현황|몇\s*명|몇명|applicant/i.test(message)) {
    return {
      handled: true,
      kind: "answer",
      title: `${title} 신청 현황`,
      summary: `총 ${applicant.total}명입니다.`,
      rows: isListRequest(message) ? applicant.rows : undefined
    };
  }

  const current = data.rows.find((row) => row.활동 === title);
  return {
    handled: true,
    kind: "answer",
    title,
    rows: current ? [current] : undefined
  };
}

async function confirmOperation(body: RequestBody) {
  const access = await getCurrentEccAccess();

  if (!access.isAdmin || !access.email) {
    return NextResponse.json(
      { error: "관리자 인증이 만료되었습니다. 다시 로그인해주세요." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  try {
    const token = cleanText(body.token, 30_000);
    const payload = verifyWoohyukmonConfirmationToken(token);

    if (
      payload.actorEmail !== access.email ||
      !isRegisteredWriteTool(payload.tool)
    ) {
      return NextResponse.json(
        { error: "확인 작업이 현재 관리자 세션과 일치하지 않습니다." },
        { status: 403 }
      );
    }

    const result =
      payload.tool === "open_activity_applications" ||
      payload.tool === "close_activity_applications"
        ? await executeActivityMutation(payload)
        : await executeMemberMutation(payload);

    return json({
      handled: true,
      kind: "result",
      title: result.failed === 0 ? "작업 완료" : "작업 결과",
      summary:
        result.failed === 0
          ? `${result.succeeded}건을 정상적으로 처리했습니다.`
          : `성공 ${result.succeeded}건, 실패 ${result.failed}건입니다.`,
      succeeded: result.succeeded,
      failed: result.failed,
      rows: result.rows
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "확인 작업을 처리하지 못했습니다."
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;

  if (cleanText(body.action, 40) === "confirm") {
    return confirmOperation(body);
  }

  const access = await getCurrentEccAccess();

  if (!access.isAdmin || !access.email) {
    return NextResponse.json(
      { error: "ECC admin-or-higher access is required." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  const message = cleanText(body.message, 2400);

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (
    /(?:raw\s*)?sql|service.?role|환경\s*변수|environment\s*variable|api\s*key|secret|github|vercel|shell|터미널|임의\s*코드|arbitrary\s*code/i.test(
      message
    )
  ) {
    return json({
      handled: true,
      kind: "answer",
      title: "지원하지 않는 작업입니다",
      summary:
        "Global Woohyukmon은 등록된 K_LINE 비즈니스 운영 도구만 사용할 수 있습니다. SQL, 비밀키, 환경변수, GitHub/Vercel, 셸·임의 코드 실행에는 접근하지 않습니다."
    });
  }

  const writeTool = detectWriteTool(message);
  if (writeTool) {
    return prepareWrite(message, body, access.email, access.role, writeTool);
  }

  const activityAnswer = await resolveReadActivity(message);
  if (activityAnswer) return json(activityAnswer);

  const memberAnswer = await resolveReadMember(message, body);
  if (memberAnswer) return json(memberAnswer);

  return json({ handled: false });
}
