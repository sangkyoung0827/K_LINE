import type { GoogleFormRegistryRow } from "./types";

// Opt-in only: legacy forms and native club applications remain untouched.
export function automationPolicy(form: Pick<GoogleFormRegistryRow, "metadata">) {
  const raw = form.metadata?.automation as { version?: unknown; capacity?: unknown } | undefined;
  return raw?.version === 1 && typeof raw.capacity === "number" && Number.isInteger(raw.capacity) && raw.capacity > 0 && raw.capacity <= 100000
    ? { capacity: raw.capacity } : null;
}

export type SubmittedResponse = { id: string; google_response_id: string; submitted_at: string };
export function responseAdmission<T extends SubmittedResponse>(form: Pick<GoogleFormRegistryRow, "metadata" | "application_deadline">, responses: T[]) {
  const policy = automationPolicy(form);
  if (!policy) return { accepted: responses, waiting: [] as T[], late: [] as T[] };
  const deadline = form.application_deadline ? Date.parse(form.application_deadline) : Infinity;
  if (Number.isNaN(deadline)) throw new Error("INVALID_DEADLINE");
  const ordered = [...responses].sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.google_response_id.localeCompare(b.google_response_id));
  const onTime: T[] = [], late: T[] = [];
  for (const row of ordered) {
    const submitted = Date.parse(row.submitted_at);
    if (!Number.isFinite(submitted)) throw new Error("INVALID_RESPONSE_TIMESTAMP");
    (submitted <= deadline ? onTime : late).push(row);
  }
  return { accepted: onTime.slice(0, policy.capacity), waiting: onTime.slice(policy.capacity), late };
}

export function automaticClosureReason(form: GoogleFormRegistryRow, now = Date.now()) {
  const policy = automationPolicy(form);
  if (!policy || form.status !== "open") return null;
  if (form.application_deadline && Date.parse(form.application_deadline) <= now) return "deadline";
  return form.response_count >= policy.capacity ? "capacity" : null;
}
