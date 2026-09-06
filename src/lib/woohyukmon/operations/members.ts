import "server-only";

import { applyEccMemberAdminUpdate } from "@/lib/eccMemberAdminActions";
import {
  getEccMemberRegistrationById,
  listEccMemberRegistrations,
  type EccMemberRegistration
} from "@/lib/eccMemberRegistrations";
import {
  isKoreanNationality,
  normalizeGender,
  normalizeNationality
} from "@/lib/woohyukmon/operations/nationality";
import {
  finishWoohyukmonAudit,
  startWoohyukmonAudit
} from "@/lib/woohyukmon/operations/audit";
import type {
  WoohyukmonConfirmationPayload,
  WoohyukmonMemberCandidate,
  WoohyukmonOperationTool,
  WoohyukmonTableRow
} from "@/lib/woohyukmon/operations/types";

export type MemberListFilter = {
  foreignOnly?: boolean;
  gender?: "Male" | "Female";
  nationality?: string;
  official?: boolean;
  paid?: boolean;
  pending?: boolean;
};

function publicMemberRow(member: EccMemberRegistration): WoohyukmonTableRow {
  return {
    이름: member.fullName,
    국적: normalizeNationality(member.nationality),
    학과: member.departmentOrMajor,
    회비: member.paymentConfirmed ? "납부" : "미납",
    정회원: member.officialMember ? "승인" : "미승인"
  };
}

export function memberCandidate(member: EccMemberRegistration): WoohyukmonMemberCandidate {
  return {
    id: member.id,
    name: member.fullName,
    departmentOrMajor: member.departmentOrMajor,
    nationality: normalizeNationality(member.nationality),
    paymentConfirmed: member.paymentConfirmed,
    officialMember: member.officialMember
  };
}

function matchesFilter(member: EccMemberRegistration, filter: MemberListFilter) {
  if (typeof filter.paid === "boolean" && member.paymentConfirmed !== filter.paid) return false;
  if (typeof filter.official === "boolean" && member.officialMember !== filter.official) return false;
  if (filter.pending && member.officialMember) return false;
  if (filter.foreignOnly && isKoreanNationality(member.nationality)) return false;

  if (
    filter.gender &&
    normalizeGender(member.gender) !== filter.gender
  ) {
    return false;
  }

  if (
    filter.nationality &&
    normalizeNationality(member.nationality).toLowerCase() !==
      normalizeNationality(filter.nationality).toLowerCase()
  ) {
    return false;
  }

  return true;
}

export async function getMemberStatistics() {
  const members = await listEccMemberRegistrations();
  const paid = members.filter((member) => member.paymentConfirmed).length;
  const official = members.filter((member) => member.officialMember).length;
  const korean = members.filter((member) => isKoreanNationality(member.nationality)).length;
  const foreign = members.length - korean;

  return {
    total: members.length,
    paid,
    unpaid: members.length - paid,
    official,
    pending: members.length - official,
    korean,
    foreign
  };
}

export async function getNationalityStatistics(foreignOnly = false) {
  const members = await listEccMemberRegistrations();
  const counts = new Map<string, number>();

  members.forEach((member) => {
    const nationality = normalizeNationality(member.nationality);
    if (foreignOnly && nationality === "South Korea") return;
    counts.set(nationality, (counts.get(nationality) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([nationality, count]) => ({ nationality, count }));
}

export async function getGenderStatistics(filter: MemberListFilter = {}) {
  const members = (await listEccMemberRegistrations()).filter((member) =>
    matchesFilter(member, filter)
  );
  const counts = new Map<string, number>();

  members.forEach((member) => {
    const gender = normalizeGender(member.gender);
    counts.set(gender, (counts.get(gender) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([gender, count]) => ({ gender, count }));
}

export async function listMembers(
  filter: MemberListFilter,
  limit = 50
) {
  const members = (await listEccMemberRegistrations()).filter((member) =>
    matchesFilter(member, filter)
  );

  return {
    total: members.length,
    members,
    rows: members.slice(0, limit).map(publicMemberRow)
  };
}

function searchText(member: EccMemberRegistration) {
  return [
    member.fullName,
    member.googleName,
    member.kakaoDisplayName
  ]
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

export async function findMembers(query: string) {
  const normalized = query.normalize("NFKC").trim().toLowerCase();
  if (!normalized) return [];

  const members = await listEccMemberRegistrations();
  return members
    .map((member) => {
      const text = searchText(member);
      const exact =
        member.fullName.normalize("NFKC").toLowerCase() === normalized ||
        member.googleName.normalize("NFKC").toLowerCase() === normalized ||
        member.kakaoDisplayName.normalize("NFKC").toLowerCase() === normalized;
      const contains = text.includes(normalized);
      return { member, score: exact ? 3 : contains ? 1 : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.member.fullName.localeCompare(b.member.fullName))
    .map((item) => item.member)
    .slice(0, 12);
}

export async function getMemberDetails(id: string) {
  return getEccMemberRegistrationById(id);
}

export async function prepareMemberMutation(input: {
  actorEmail: string;
  actorRole: string;
  tool: WoohyukmonOperationTool;
  targetIds: string[];
  note?: string;
}) {
  const targets = (
    await Promise.all(input.targetIds.slice(0, 50).map((id) => getEccMemberRegistrationById(id)))
  ).filter((member): member is EccMemberRegistration => Boolean(member));

  if (targets.length === 0) {
    return null;
  }

  const expected: WoohyukmonConfirmationPayload["expected"] = targets.map((member) => ({
    id: member.id,
    paymentConfirmed: member.paymentConfirmed,
    officialMember: member.officialMember,
    status: member.status,
    adminNote: member.adminNote,
    updatedAt: member.updatedAt
  }));

  return {
    tool: input.tool,
    targetIds: targets.map((member) => member.id),
    expected,
    args: { note: input.note?.trim().slice(0, 1000) || undefined },
    rows: targets.slice(0, 25).map(publicMemberRow),
    targetCount: targets.length
  };
}

function expectedFor(
  payload: WoohyukmonConfirmationPayload,
  id: string
) {
  return payload.expected.find((item) => item.id === id);
}

function stateMatches(
  member: EccMemberRegistration,
  expected: ReturnType<typeof expectedFor>
) {
  if (!expected) return false;

  return (
    member.paymentConfirmed === expected.paymentConfirmed &&
    member.officialMember === expected.officialMember &&
    member.status === expected.status &&
    member.adminNote === expected.adminNote &&
    member.updatedAt === expected.updatedAt
  );
}

function mutationLabel(tool: WoohyukmonOperationTool) {
  switch (tool) {
    case "mark_payment_confirmed":
      return "payment_confirmed";
    case "mark_payment_unconfirmed":
      return "payment_unconfirmed";
    case "approve_official_member":
      return "official_member_approved";
    case "revoke_official_member":
      return "official_member_revoked";
    case "append_member_admin_note":
      return "admin_note_updated";
    default:
      return tool;
  }
}

export async function executeMemberMutation(
  payload: WoohyukmonConfirmationPayload
) {
  let succeeded = 0;
  let failed = 0;
  const rows: WoohyukmonTableRow[] = [];

  for (const id of payload.targetIds.slice(0, 50)) {
    const current = await getEccMemberRegistrationById(id);
    const expected = expectedFor(payload, id);

    if (!current) {
      failed += 1;
      rows.push({ 대상: "삭제되었거나 찾을 수 없는 회원", 결과: "실패" });
      continue;
    }

    if (!stateMatches(current, expected)) {
      failed += 1;
      rows.push({
        이름: current.fullName,
        결과: "상태 변경 감지",
        안내: "현재 상태를 다시 확인한 뒤 재요청해 주세요."
      });
      continue;
    }

    const nextPayment =
      payload.tool === "mark_payment_confirmed" ||
      payload.tool === "approve_official_member"
        ? true
        : payload.tool === "mark_payment_unconfirmed" ||
            payload.tool === "revoke_official_member"
          ? false
          : current.paymentConfirmed;

    const nextAdminNote =
      payload.tool === "append_member_admin_note"
        ? [current.adminNote.trim(), payload.args.note?.trim() || ""]
            .filter(Boolean)
            .join("\n")
            .slice(0, 1200)
        : current.adminNote;

    const before = {
      paymentConfirmed: current.paymentConfirmed,
      officialMember: current.officialMember,
      status: current.status,
      adminNote: current.adminNote
    };
    const planned = {
      paymentConfirmed: nextPayment,
      officialMember:
        payload.tool === "append_member_admin_note"
          ? current.officialMember
          : nextPayment,
      adminNote: nextAdminNote
    };

    let audit:
      | Awaited<ReturnType<typeof startWoohyukmonAudit>>
      | null = null;

    try {
      audit = await startWoohyukmonAudit({
        actorEmail: payload.actorEmail,
        actorOriginalRole: payload.actorRole,
        actionType: mutationLabel(payload.tool),
        target: `ecc_member_registration:${current.id}`,
        targetType: "ecc_member_registration",
        targetId: current.id,
        previousValue: before,
        newValue: planned
      });

      const result = await applyEccMemberAdminUpdate({
        adminEmail: payload.actorEmail,
        adminNote: nextAdminNote,
        id: current.id,
        paymentConfirmed: nextPayment
      });

      const updated = result.registration ?? current;

      await finishWoohyukmonAudit(audit, { status: "success" });
      succeeded += 1;
      rows.push({
        이름: updated.fullName,
        회비: updated.paymentConfirmed ? "납부" : "미납",
        정회원: updated.officialMember ? "승인" : "미승인",
        결과: result.changed ? "저장 완료" : "변경 없음"
      });
    } catch (error) {
      failed += 1;
      if (audit) {
        try {
          await finishWoohyukmonAudit(audit, {
            status: "failure",
            errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error"
          });
        } catch (auditError) {
          console.error("Woohyukmon audit completion failed", auditError);
        }
      }
      rows.push({
        이름: current.fullName,
        결과: "실패"
      });
    }
  }

  return { succeeded, failed, rows };
}
