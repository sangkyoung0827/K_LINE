import "server-only";

import { supabaseRequest } from "@/lib/supabaseServer";

export type ActivityRecordSource = "ecc" | "hanhwal";

export type ActivityCloseEvent = {
  activityId: string;
  activityInstanceId: string;
  registrationClosedAt: string;
};

export type PendingActivityRating = {
  activityTitle: string;
  eligibleAt: string;
  id: string;
  source: ActivityRecordSource;
};

type ActivityApplicationRow = {
  activity_id: string;
  activity_instance_id: string | null;
  activity_title: string | null;
  created_at: string;
  registration_closed_at: string | null;
  requires_payment: boolean | null;
  status: string | null;
  user_id: string | null;
};

type ActivityRecordRow = {
  activity_title_snapshot: string;
  eligible_at: string;
  id: string;
  source: ActivityRecordSource;
};

const recordsTable = "user_activity_records";
const applicationTables: Record<ActivityRecordSource, string> = {
  ecc: "ecc_activity_applications",
  hanhwal: "hanhwal_activity_applications"
};
const applicationColumns =
  "activity_id,activity_instance_id,activity_title,created_at,registration_closed_at,requires_payment,status,user_id";
const pendingRecordColumns = "id,source,activity_title_snapshot,eligible_at";
const ratingDelayMs = 12 * 60 * 60 * 1000;

function plusTwelveHours(value: string) {
  return new Date(new Date(value).getTime() + ratingDelayMs).toISOString();
}

function isPaymentComplete(application: ActivityApplicationRow) {
  return application.requires_payment === false || application.status === "paid";
}

function applicationTitle(application: ActivityApplicationRow) {
  return application.activity_title?.trim() || application.activity_id;
}

function toActivityRecords(
  userId: string,
  source: ActivityRecordSource,
  applications: ActivityApplicationRow[]
) {
  return applications
    .filter((application) => application.activity_instance_id && application.registration_closed_at)
    .filter(isPaymentComplete)
    .map((application) => ({
      activity_date_snapshot: application.registration_closed_at,
      activity_id: application.activity_id,
      activity_instance_id: application.activity_instance_id,
      activity_title_snapshot: applicationTitle(application),
      eligible_at: plusTwelveHours(application.registration_closed_at as string),
      source,
      user_id: userId
    }));
}

async function insertActivityRecords(records: Record<string, unknown>[]) {
  if (records.length === 0) {
    return;
  }

  await supabaseRequest(`${recordsTable}?on_conflict=user_id,source,activity_instance_id`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(records)
  });
}

async function listEligibleApplications(userId: string, source: ActivityRecordSource) {
  const table = applicationTables[source];
  return supabaseRequest<ActivityApplicationRow[]>(
    `${table}?select=${applicationColumns}&user_id=eq.${encodeURIComponent(
      userId
    )}&activity_instance_id=not.is.null&registration_closed_at=not.is.null`
  );
}

export async function markActivityApplicationsClosed(
  source: ActivityRecordSource,
  closeEvents: ActivityCloseEvent[]
) {
  const table = applicationTables[source];

  await Promise.all(
    closeEvents.map((event) =>
      supabaseRequest(
        `${table}?activity_id=eq.${encodeURIComponent(
          event.activityId
        )}&activity_instance_id=eq.${encodeURIComponent(
          event.activityInstanceId
        )}&registration_closed_at=is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ registration_closed_at: event.registrationClosedAt })
        }
      )
    )
  );
}

export async function createActivityRecordsForClosedActivities(
  source: ActivityRecordSource,
  closeEvents: ActivityCloseEvent[]
) {
  const table = applicationTables[source];
  const batches = await Promise.all(
    closeEvents.map((event) =>
      supabaseRequest<ActivityApplicationRow[]>(
        `${table}?select=${applicationColumns}&activity_id=eq.${encodeURIComponent(
          event.activityId
        )}&activity_instance_id=eq.${encodeURIComponent(
          event.activityInstanceId
        )}&user_id=not.is.null&registration_closed_at=not.is.null`
      )
    )
  );
  const records = batches
    .flat()
    .flatMap((application) =>
      application.user_id ? toActivityRecords(application.user_id, source, [application]) : []
    );

  await insertActivityRecords(records);
}

export async function ensureUserActivityRecords(userId: string) {
  const results = await Promise.allSettled(
    (Object.keys(applicationTables) as ActivityRecordSource[]).map(async (source) => {
      const applications = await listEligibleApplications(userId, source);
      await insertActivityRecords(toActivityRecords(userId, source, applications));
    })
  );

  return results.every((result) => result.status === "fulfilled");
}

export async function getPendingActivityRating(userId: string) {
  await ensureUserActivityRecords(userId);
  const now = new Date().toISOString();
  const rows = await supabaseRequest<ActivityRecordRow[]>(
    `${recordsTable}?select=${pendingRecordColumns}&user_id=eq.${encodeURIComponent(
      userId
    )}&rating=is.null&dismissed_at=is.null&eligible_at=lte.${encodeURIComponent(
      now
    )}&order=eligible_at.asc&limit=1`
  );
  const record = rows[0];

  return record
    ? {
        activityTitle: record.activity_title_snapshot,
        eligibleAt: record.eligible_at,
        id: record.id,
        source: record.source
      }
    : null;
}

export async function rateActivityRecord(input: {
  rating: number;
  recordId: string;
  userId: string;
}) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<{ id: string }[]>(
    `${recordsTable}?id=eq.${encodeURIComponent(
      input.recordId
    )}&user_id=eq.${encodeURIComponent(input.userId)}&rating=is.null&dismissed_at=is.null&select=id`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        rating: input.rating,
        rated_at: now,
        updated_at: now
      })
    }
  );

  return rows[0] ?? null;
}

export async function dismissActivityRecord(input: { recordId: string; userId: string }) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<{ id: string }[]>(
    `${recordsTable}?id=eq.${encodeURIComponent(
      input.recordId
    )}&user_id=eq.${encodeURIComponent(input.userId)}&rating=is.null&dismissed_at=is.null&select=id`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        dismissed_at: now,
        rating: null,
        updated_at: now
      })
    }
  );

  return rows[0] ?? null;
}
