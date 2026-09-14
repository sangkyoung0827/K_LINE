import "server-only";

import { scheduleApplicationPreference } from "@/lib/activity-preferences/hooks";
import type {
  HanhwalStructuredActivity,
  HanhwalStructuredKind,
  HanhwalStructuredPayload,
  HanhwalStructuredSubmission,
  HanhwalStructuredSummary
} from "@/lib/hanhwalStructuredTypes";
import {
  cleanHanhwalStructuredActivityInput,
  cleanHanhwalStructuredSubmissionPayload,
  HanhwalStructuredError
} from "@/lib/hanhwalStructuredValidation";
import { normalizeEmail } from "@/lib/admin";
import { summarizeHanhwalStructuredActivity } from "@/lib/hanhwalStructuredSummary";
import { SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";

type ActivityRow = {
  configuration: Record<string, unknown>;
  created_at: string;
  deadline: string;
  description: string;
  event_date: string | null;
  fee_krw: number | null;
  id: string;
  item_name: string;
  kind: HanhwalStructuredKind;
  location: string;
  notes: string;
  pickup_information: string;
  pricing_note: string;
  status: "draft" | "open" | "closed";
  title: string;
  unit_price_krw: number | null;
  updated_at: string;
};

type SubmissionRow = {
  activity_id: string;
  applied_at: string;
  fulfillment_status: "ordered" | "ready" | "received" | null;
  id: string;
  kind: HanhwalStructuredKind;
  payment_status: "unconfirmed" | "confirmed";
  payload: Record<string, unknown>;
  status: "submitted" | "cancelled";
  updated_at: string;
  user_email: string;
  user_name: string;
};

const activityTable = "hanhwal_structured_activities";
const submissionTable = "hanhwal_structured_submissions";
const activityColumns = "id,kind,title,description,event_date,location,deadline,fee_krw,unit_price_krw,pricing_note,item_name,pickup_information,notes,status,configuration,created_at,updated_at";
const submissionColumns = "id,activity_id,kind,user_email,user_name,payload,status,payment_status,fulfillment_status,applied_at,updated_at";

function toActivity(row: ActivityRow): HanhwalStructuredActivity {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    eventDate: row.event_date ?? "",
    location: row.location,
    deadline: row.deadline,
    feeKrw: row.fee_krw,
    unitPriceKrw: row.unit_price_krw,
    pricingNote: row.pricing_note,
    itemName: row.item_name,
    pickupInformation: row.pickup_information,
    notes: row.notes,
    status: row.status,
    configuration: row.configuration as HanhwalStructuredActivity["configuration"],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSubmission(row: SubmissionRow, includeEmail: boolean): HanhwalStructuredSubmission {
  return {
    id: row.id,
    activityId: row.activity_id,
    kind: row.kind,
    userName: row.user_name,
    ...(includeEmail ? { userEmail: row.user_email } : {}),
    payload: row.payload as HanhwalStructuredPayload,
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    appliedAt: row.applied_at,
    updatedAt: row.updated_at
  };
}

function activityBody(activity: Omit<HanhwalStructuredActivity, "createdAt" | "id" | "updatedAt">, email: string) {
  return {
    kind: activity.kind,
    title: activity.title,
    description: activity.description,
    event_date: activity.eventDate || null,
    location: activity.location,
    deadline: activity.deadline,
    fee_krw: activity.feeKrw,
    unit_price_krw: activity.unitPriceKrw,
    pricing_note: activity.pricingNote,
    item_name: activity.itemName,
    pickup_information: activity.pickupInformation,
    notes: activity.notes,
    status: activity.status,
    configuration: activity.configuration,
    updated_by: email
  };
}

function isDuplicate(error: unknown) {
  return error instanceof SupabaseRequestError && /23505|duplicate key/i.test(error.message);
}

export async function listHanhwalStructured(input: { canManage: boolean; email: string }) {
  const activityFilter = input.canManage ? "" : "&status=neq.draft";
  const activities = (await supabaseRequest<ActivityRow[]>(
    `${activityTable}?select=${activityColumns}${activityFilter}&order=deadline.desc`
  )).map(toActivity);
  const email = normalizeEmail(input.email);
  const filter = input.canManage ? "" : `&user_email=eq.${encodeURIComponent(email)}`;
  const submissions = (await supabaseRequest<SubmissionRow[]>(
    `${submissionTable}?select=${submissionColumns}${filter}&order=applied_at.desc`
  )).map((row) => toSubmission(row, input.canManage));

  const summaries: Record<string, HanhwalStructuredSummary> = {};
  if (input.canManage) {
    for (const activity of activities) {
      summaries[activity.id] = summarizeHanhwalStructuredActivity(activity, submissions);
    }
  }
  return { activities, submissions, summaries };
}

export async function createHanhwalStructuredActivity(input: Record<string, unknown>, email: string) {
  const cleaned = cleanHanhwalStructuredActivityInput(input);
  const rows = await supabaseRequest<ActivityRow[]>(`${activityTable}?select=${activityColumns}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...activityBody(cleaned, email), created_by: email })
  });
  return rows[0] ? toActivity(rows[0]) : null;
}

export async function updateHanhwalStructuredActivity(id: string, input: Record<string, unknown>, email: string) {
  const existingRows = await supabaseRequest<ActivityRow[]>(
    `${activityTable}?id=eq.${encodeURIComponent(id)}&select=${activityColumns}&limit=1`
  );
  if (!existingRows[0]) throw new HanhwalStructuredError("ACTIVITY_NOT_FOUND", 404, "Application round was not found.");
  const existing = toActivity(existingRows[0]);
  const cleaned = cleanHanhwalStructuredActivityInput(input, existing);
  const rows = await supabaseRequest<ActivityRow[]>(
    `${activityTable}?id=eq.${encodeURIComponent(id)}&select=${activityColumns}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(activityBody(cleaned, email)) }
  );
  return rows[0] ? toActivity(rows[0]) : null;
}

async function getActivity(id: string) {
  const rows = await supabaseRequest<ActivityRow[]>(
    `${activityTable}?id=eq.${encodeURIComponent(id)}&select=${activityColumns}&limit=1`
  );
  if (!rows[0]) throw new HanhwalStructuredError("ACTIVITY_NOT_FOUND", 404, "Application round was not found.");
  return toActivity(rows[0]);
}

export async function submitHanhwalStructured(input: Record<string, unknown>, identity: { email: string; name: string }) {
  const activityId = typeof input.activityId === "string" ? input.activityId : "";
  const activity = await getActivity(activityId);
  if (activity.status !== "open" || Date.parse(activity.deadline) <= Date.now()) {
    throw new HanhwalStructuredError("APPLICATION_CLOSED", 409, "This application round is closed.");
  }
  const payloadInput = input.payload && typeof input.payload === "object" ? input.payload as Record<string, unknown> : {};
  const payload = cleanHanhwalStructuredSubmissionPayload(activity, payloadInput);
  if (activity.kind === "competition") {
    const divisionId = (payload as { divisionId: string }).divisionId;
    const division = (activity.configuration as { divisions: Array<{ capacity: number | null; id: string }> }).divisions.find((row) => row.id === divisionId);
    if (division?.capacity) {
      const rows = await supabaseRequest<SubmissionRow[]>(
        `${submissionTable}?activity_id=eq.${encodeURIComponent(activity.id)}&status=eq.submitted&select=${submissionColumns}`
      );
      const count = rows.filter((row) => row.payload.divisionId === divisionId).length;
      if (count >= division.capacity) throw new HanhwalStructuredError("DIVISION_FULL", 409, "This division is full.");
    }
  }
  const now = new Date().toISOString();
  let rows: SubmissionRow[];
  try {
    rows = await supabaseRequest<SubmissionRow[]>(`${submissionTable}?select=${submissionColumns}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        activity_id: activity.id,
        kind: activity.kind,
        user_email: normalizeEmail(identity.email),
        user_name: identity.name,
        payload,
        status: "submitted",
        fulfillment_status: activity.kind === "competition" ? null : "ordered",
        updated_by: identity.email,
        applied_at: now
      })
    });
  } catch (error) {
    if (isDuplicate(error)) throw new HanhwalStructuredError("ALREADY_SUBMITTED", 409, "You already submitted this application.");
    if (error instanceof SupabaseRequestError && /HANHWAL_DIVISION_FULL/i.test(error.message)) {
      throw new HanhwalStructuredError("DIVISION_FULL", 409, "This division is full.");
    }
    if (error instanceof SupabaseRequestError && /HANHWAL_APPLICATION_CLOSED/i.test(error.message)) {
      throw new HanhwalStructuredError("APPLICATION_CLOSED", 409, "This application round is closed.");
    }
    throw error;
  }
  if (rows[0] && activity.kind === "competition") {
    scheduleApplicationPreference("hanhwal", {
      id: rows[0].id,
      created_at: rows[0].applied_at,
      activity_id: "competition",
      activity_instance_id: activity.id,
      user_id: identity.email
    });
  }
  return rows[0] ? toSubmission(rows[0], false) : null;
}

export async function updateHanhwalStructuredSubmission(input: Record<string, unknown>, actor: { canManage: boolean; email: string }) {
  const id = typeof input.id === "string" ? input.id : "";
  const rows = await supabaseRequest<SubmissionRow[]>(
    `${submissionTable}?id=eq.${encodeURIComponent(id)}&select=${submissionColumns}&limit=1`
  );
  const existing = rows[0];
  if (!existing) throw new HanhwalStructuredError("SUBMISSION_NOT_FOUND", 404, "Submission was not found.");
  if (!actor.canManage && normalizeEmail(existing.user_email) !== normalizeEmail(actor.email)) {
    throw new HanhwalStructuredError("FORBIDDEN", 403, "You cannot edit this submission.");
  }
  const activity = await getActivity(existing.activity_id);
  const patch: Record<string, unknown> = { updated_by: actor.email };
  if (actor.canManage) {
    if ("paymentStatus" in input) {
      if (input.paymentStatus !== "confirmed" && input.paymentStatus !== "unconfirmed") {
        throw new HanhwalStructuredError("INVALID_PAYMENT_STATUS", 409, "Select a valid payment status.");
      }
      patch.payment_status = input.paymentStatus;
    }
    if ("fulfillmentStatus" in input) {
      if (activity.kind === "competition" || !["ordered", "ready", "received"].includes(String(input.fulfillmentStatus))) {
        throw new HanhwalStructuredError("INVALID_FULFILLMENT_STATUS", 409, "Select a valid fulfillment status for a physical order.");
      }
      patch.fulfillment_status = input.fulfillmentStatus;
    }
    if (input.payload && typeof input.payload === "object") patch.payload = cleanHanhwalStructuredSubmissionPayload(activity, input.payload as Record<string, unknown>);
  } else {
    if (activity.status !== "open" || Date.parse(activity.deadline) <= Date.now()) {
      throw new HanhwalStructuredError("APPLICATION_LOCKED", 409, "This submission is locked after the deadline.");
    }
    if (input.action === "cancel") patch.status = "cancelled";
    else if (input.payload && typeof input.payload === "object") patch.payload = cleanHanhwalStructuredSubmissionPayload(activity, input.payload as Record<string, unknown>);
  }
  const updated = await supabaseRequest<SubmissionRow[]>(
    `${submissionTable}?id=eq.${encodeURIComponent(id)}&select=${submissionColumns}`,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }
  );
  return updated[0] ? toSubmission(updated[0], actor.canManage) : null;
}
