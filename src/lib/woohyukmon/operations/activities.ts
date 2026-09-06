import "server-only";

import { getEccActivityStatuses } from "@/lib/eccActivityStatuses";
import { applyEccActivityStatusAdminUpdate } from "@/lib/eccActivityAdminActions";
import { getEccActivityCatalog } from "@/lib/eccOperations";
import { supabaseRequest } from "@/lib/supabaseServer";
import {
  finishWoohyukmonAudit,
  startWoohyukmonAudit
} from "@/lib/woohyukmon/operations/audit";
import {
  normalizeGender,
  normalizeNationality
} from "@/lib/woohyukmon/operations/nationality";
import type {
  WoohyukmonConfirmationPayload,
  WoohyukmonOperationTool,
  WoohyukmonTableRow
} from "@/lib/woohyukmon/operations/types";

type ApplicationRow = {
  id: string;
  activity_id: string | null;
  activity_title: string | null;
  name: string;
  gender: string | null;
  nationality: string | null;
  status: string;
};

export async function listActivityOverview() {
  const [catalog, statuses, applications] = await Promise.all([
    getEccActivityCatalog({ includeArchived: true }),
    getEccActivityStatuses(),
    supabaseRequest<ApplicationRow[]>(
      "ecc_activity_applications?select=id,activity_id,activity_title,name,gender,nationality,status&limit=2000"
    )
  ]);

  const rows: WoohyukmonTableRow[] = catalog
    .filter((item) => !item.archived)
    .map((item) => ({
      활동: item.titleKo || item.titleEn,
      상태: statuses.statuses[item.id] ? "모집 중" : "마감",
      신청자: applications.filter((application) => application.activity_id === item.id).length
    }));

  return { catalog, statuses, applications, rows };
}

export async function findActivityFromText(message: string) {
  const overview = await listActivityOverview();
  const normalized = message.normalize("NFKC").toLowerCase();

  const aliases: Record<string, string[]> = {
    gathering: ["gathering", "게더링", "국제 교류"],
    mt: ["mt", "엠티"],
    special: ["special event", "special", "특별 이벤트"],
    opening: ["개강총회", "opening", "semester opening"],
    farewell: ["종강총회", "farewell"],
    "english-class": ["english class", "영어수업", "영어 수업"]
  };

  const matched = overview.catalog.find((item) => {
    if (item.archived) return false;
    const candidates = [
      item.id,
      item.titleKo,
      item.titleEn,
      ...(aliases[item.id] ?? [])
    ]
      .filter(Boolean)
      .map((value) => value.normalize("NFKC").toLowerCase());

    return candidates.some((candidate) => normalized.includes(candidate));
  });

  return { ...overview, activity: matched ?? null };
}

export function activityApplicantRows(
  applications: ApplicationRow[],
  activityId: string,
  limit = 50
) {
  const filtered = applications.filter((application) => application.activity_id === activityId);

  return {
    total: filtered.length,
    rows: filtered.slice(0, limit).map((application) => ({
      이름: application.name,
      국적: normalizeNationality(application.nationality ?? ""),
      성별: normalizeGender(application.gender ?? ""),
      상태: application.status
    })),
    applications: filtered
  };
}

export function activityNationalityCount(
  applications: ApplicationRow[],
  activityId: string,
  nationality: string
) {
  const canonical = normalizeNationality(nationality);
  return applications.filter(
    (application) =>
      application.activity_id === activityId &&
      normalizeNationality(application.nationality ?? "") === canonical
  ).length;
}

export function activityGenderStats(
  applications: ApplicationRow[],
  activityId: string
) {
  const counts = new Map<string, number>();

  applications
    .filter((application) => application.activity_id === activityId)
    .forEach((application) => {
      const gender = normalizeGender(application.gender ?? "");
      counts.set(gender, (counts.get(gender) ?? 0) + 1);
    });

  return Array.from(counts.entries()).map(([gender, count]) => ({
    gender,
    count
  }));
}

export async function prepareActivityMutation(input: {
  actorEmail: string;
  actorRole: string;
  activityId: string;
  tool: Extract<
    WoohyukmonOperationTool,
    "open_activity_applications" | "close_activity_applications"
  >;
}) {
  const [catalog, statuses] = await Promise.all([
    getEccActivityCatalog({ includeArchived: true }),
    getEccActivityStatuses()
  ]);
  const activity = catalog.find((item) => item.id === input.activityId && !item.archived);

  if (!activity) return null;

  const isOpen = Boolean(statuses.statuses[activity.id]);

  return {
    tool: input.tool,
    targetIds: [activity.id],
    expected: [
      {
        id: activity.id,
        activityOpen: isOpen
      }
    ],
    args: { activityId: activity.id },
    rows: [
      {
        활동: activity.titleKo || activity.titleEn,
        현재상태: isOpen ? "모집 중" : "마감",
        변경예정:
          input.tool === "open_activity_applications" ? "모집 시작" : "모집 종료"
      }
    ],
    targetCount: 1,
    activity
  };
}

export async function executeActivityMutation(
  payload: WoohyukmonConfirmationPayload
) {
  const activityId = payload.args.activityId || payload.targetIds[0];
  const expected = payload.expected.find((item) => item.id === activityId);

  if (!activityId || typeof expected?.activityOpen !== "boolean") {
    return {
      succeeded: 0,
      failed: 1,
      rows: [{ 결과: "작업 정보가 유효하지 않습니다." }]
    };
  }

  const [catalog, statuses] = await Promise.all([
    getEccActivityCatalog({ includeArchived: true }),
    getEccActivityStatuses()
  ]);
  const activity = catalog.find((item) => item.id === activityId && !item.archived);

  if (!activity) {
    return {
      succeeded: 0,
      failed: 1,
      rows: [{ 결과: "활동을 찾을 수 없습니다." }]
    };
  }

  const currentOpen = Boolean(statuses.statuses[activityId]);

  if (currentOpen !== expected.activityOpen) {
    return {
      succeeded: 0,
      failed: 1,
      rows: [
        {
          활동: activity.titleKo || activity.titleEn,
          결과: "상태 변경 감지",
          안내: "현재 상태를 다시 확인한 뒤 재요청해 주세요."
        }
      ]
    };
  }

  const nextOpen = payload.tool === "open_activity_applications";
  let audit: Awaited<ReturnType<typeof startWoohyukmonAudit>> | null = null;

  try {
    audit = await startWoohyukmonAudit({
      actorEmail: payload.actorEmail,
      actorOriginalRole: payload.actorRole,
      actionType: nextOpen ? "activity_applications_opened" : "activity_applications_closed",
      target: `ecc_activity:${activityId}`,
      targetType: "ecc_activity",
      targetId: activityId,
      previousValue: { isOpen: currentOpen },
      newValue: { isOpen: nextOpen }
    });

    await applyEccActivityStatusAdminUpdate({
      adminEmail: payload.actorEmail,
      updates: { [activityId]: nextOpen }
    });

    await finishWoohyukmonAudit(audit, { status: "success" });

    return {
      succeeded: 1,
      failed: 0,
      rows: [
        {
          활동: activity.titleKo || activity.titleEn,
          상태: nextOpen ? "모집 중" : "마감",
          결과: "저장 완료"
        }
      ]
    };
  } catch (error) {
    if (audit) {
      try {
        await finishWoohyukmonAudit(audit, {
          status: "failure",
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown error"
        });
      } catch (auditError) {
        console.error("Woohyukmon activity audit completion failed", auditError);
      }
    }

    return {
      succeeded: 0,
      failed: 1,
      rows: [
        {
          활동: activity.titleKo || activity.titleEn,
          결과: "실패"
        }
      ]
    };
  }
}
