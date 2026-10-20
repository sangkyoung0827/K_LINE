import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseRequest } from "@/lib/googleForms/store";
import { assertGoogleFormsTestEnvironment } from "@/lib/googleForms/safety";
import { createGoogleForm, registryColumns, verifyGoogleFormDraft, withPersonalGoogleConnection, getGoogleConnectionStatus, syncGoogleFormResponses } from "@/lib/googleForms/googleApi";
import { applicantNames } from "@/lib/googleForms/applicants";
import { actualResponderUrl } from "@/lib/googleForms/responses";
import { noticeBody } from "@/lib/googleForms/planning";
import { eccFormApplicationUrl } from "@/lib/googleForms/eccResponderEntry";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";
import { createSignedWoohyukmonPayload, verifySignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";
import { generateEventPlan, sanitizeEventRequest } from "./ai";
import { eventClarification } from "./clarification";
import { assertStudioAccess, type StudioAccess } from "./access";
import { resolveStudioClub } from "./organizer";
import { club, formDraft, parseEventPlan, StudioError, type EventPlan, type StudioClub } from "./model";

export type StudioJob = {
  id: string; club_key: StudioClub; plan: EventPlan; revision: number; state: "draft" | "running" | "failed" | "notice_saved";
  form_registry_id: string | null; notice_id: string | null; last_error: string | null;
  ai_metadata: Record<string, unknown>; created_by: string; updated_at: string;
};
type Approval = { namespace: string; actor: string; club: StudioClub; job: string; revision: number; hash: string; expires: number };
const jobs = "event_studio_jobs";
const jobQuery = (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new StudioError("INVALID_JOB_ID");
  return `${jobs}?id=eq.${id}`;
};
const hash = (plan: EventPlan) => createHash("sha256").update(JSON.stringify(plan)).digest("hex");
export const studioAdapters = { ecc: { creationSupported: true }, hanhwal: { creationSupported: true }, social_impact_union: { creationSupported: false }, personal: { creationSupported: true } };
async function loadJob(id: string, access: StudioAccess, write = false) {
  const rows = await supabaseRequest<StudioJob[]>(`${jobQuery(id)}&club_key=in.(${access.manageableClubs.join(",")})&select=*&limit=1`);
  if (!rows[0]) throw new StudioError("JOB_NOT_FOUND", 404);
  if (rows[0].club_key === "personal" && rows[0].created_by !== access.email) throw new StudioError("JOB_NOT_FOUND", 404);
  assertStudioAccess(access, rows[0].club_key, write);
  return rows[0];
}
function preview(job: StudioJob, access: StudioAccess) {
  const missing = [...job.plan.missingInformation];
  if (job.ai_metadata.formDraftVersion === 2 && job.plan.applicationDeadline?.length === 10) missing.push("applicationDeadlineTime");
  const canCreate = !access.readOnly && studioAdapters[job.club_key].creationSupported && !missing.length;
  const token = canCreate ? createSignedWoohyukmonPayload({ namespace: "event_studio_v1", actor: access.email, club: job.club_key, job: job.id, revision: job.revision, hash: hash(job.plan), expires: Date.now() + 600000 } satisfies Approval) : null;
  return { job, token, creationSupported: studioAdapters[job.club_key].creationSupported, missing, clarification: eventClarification(missing, job.plan.title) };
}
async function result(job: StudioJob, access: StudioAccess) {
  if (!job.form_registry_id) return preview(job, access);
  const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${job.form_registry_id}&club_key=eq.${job.club_key}&select=${registryColumns}&limit=1`);
  if (!rows[0]) throw new StudioError("FORM_REGISTRY_NOT_FOUND", 409);
  const form = rows[0];
  if (form.status === "archived") throw new StudioError("EVENT_ARCHIVED", 410);
  return { ...preview(job, access), form, notice: noticeBody(`${job.plan.noticeKo}\n\n${job.plan.noticeEn}`),
    applicationUrl: eccFormApplicationUrl(form), recruitmentOpen: form.status === "open" };
}
function knownError(error: unknown, depth = 0): string {
  if (error instanceof StudioError) return error.code;
  if (depth < 3 && error instanceof Error && error.cause instanceof Error) {
    const causeCode = knownError(error.cause, depth + 1);
    if (causeCode === "GOOGLE_RECONNECT_REQUIRED" || causeCode === "GOOGLE_AUTH_UNAVAILABLE" || causeCode === "GOOGLE_RESPONDER_URL_INVALID" || causeCode === "GOOGLE_FORM_CONTENT_MISMATCH") return causeCode;
  }
  const message = error instanceof Error ? error.message : "";
  if (message === "GOOGLE_RECONNECT_REQUIRED" || message === "GOOGLE_AUTH_UNAVAILABLE") return message;
  if (message.startsWith("FORM_SETUP_RETRYABLE")) return "FORM_SETUP_RETRYABLE";
  if (message.includes("UNCERTAIN")) return "FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED";
  if (message.includes("OAuth") || message.includes("token exchange")) return "GOOGLE_RECONNECT_REQUIRED";
  if (message.includes("RESPONDER")) return "GOOGLE_RESPONDER_URL_INVALID";
  if (message.includes("GOOGLE_FORM_CONTENT_MISMATCH")) return "GOOGLE_FORM_CONTENT_MISMATCH";
  return "EVENT_STUDIO_EXTERNAL_STEP_FAILED";
}
async function execute(job: StudioJob, access: StudioAccess) {
  if (!studioAdapters[job.club_key].creationSupported) throw new StudioError("CLUB_ADAPTER_NOT_READY", 409);
  if (job.plan.missingInformation.length) throw new StudioError("EVENT_INFORMATION_MISSING", 409);
  if (job.ai_metadata.formDraftVersion === 2 && job.plan.applicationDeadline?.length === 10) throw new StudioError("EVENT_DEADLINE_TIME_REQUIRED", 409);
  if (job.state === "notice_saved") return result(job, access);
  if (job.state === "running") throw new StudioError("JOB_RUNNING_RECOVERY_REQUIRED", 409);
  const locked = await supabaseRequest<StudioJob[]>(`${jobQuery(job.id)}&revision=eq.${job.revision}&state=eq.${job.state}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ state: "running", last_error: null, updated_at: new Date().toISOString() }),
  });
  if (!locked[0]) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
  try {
    // Existing attempts retain their exact draft/hash; only newly planned jobs opt in.
    const draft = formDraft(job.plan, job.ai_metadata.formDraftVersion === 2 ? 2 : 1);
    draft.activityId = job.id;
    const form = await createGoogleForm(draft, job.created_by, `studio_${job.id}`);
    actualResponderUrl(form.responder_url);
    if (await verifyGoogleFormDraft(form.google_form_id, draft) !== form.responder_url) throw new StudioError("GOOGLE_RESPONDER_URL_INVALID");
    await supabaseRequest(jobQuery(job.id), { method: "PATCH", body: JSON.stringify({ form_registry_id: form.id }) });
    const link = eccFormApplicationUrl(form);
    const content = `${noticeBody(`${job.plan.noticeKo}\n\n${job.plan.noticeEn}`)}\n\n신청 링크 / Application Form\n${link}`;
    if (!content.endsWith(link)) throw new StudioError("NOTICE_APPLICATION_LINK_MISSING");
    // This is the private Forms notice table, never the clubs' published boards.
    await supabaseRequest("club_board_posts?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: job.id, board_id: job.club_key, title: job.plan.title, content, author_name: access.email, status: "draft", media: [] }) });
    const saved = await supabaseRequest<{ id: string; content: string; status: string }[]>(`club_board_posts?id=eq.${job.id}&board_id=eq.${job.club_key}&select=id,content,status&limit=1`);
    if (saved[0]?.status !== "draft" || !saved[0].content.includes(link)) throw new StudioError("NOTICE_SAVE_NOT_CONFIRMED", 502);
    const updated = await supabaseRequest<StudioJob[]>(`${jobQuery(job.id)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ state: "notice_saved", notice_id: job.id, updated_at: new Date().toISOString() }) });
    return result(updated[0], access);
  } catch (error) {
    const code = knownError(error);
    await supabaseRequest(jobQuery(job.id), { method: "PATCH", body: JSON.stringify({ state: "failed", last_error: code, updated_at: new Date().toISOString() }) }).catch(() => undefined);
    throw new StudioError(code, 502);
  }
}
export async function studioOperation(access: StudioAccess, body: Record<string, unknown>) {
  assertGoogleFormsTestEnvironment();
  if (!access.email) throw new StudioError("LOGIN_REQUIRED", 401);
  if (!access.manageableClubs.length) throw new StudioError("CLUB_ADMIN_REQUIRED", 403);
  const action = body.action;
  if (action === "list") {
    const managed = access.manageableClubs.filter(key => key !== "personal");
    const own = access.manageableClubs.includes("personal") ? await supabaseRequest<StudioJob[]>(`${jobs}?club_key=eq.personal&created_by=eq.${encodeURIComponent(access.email)}&select=*&order=updated_at.desc&limit=50`) : [];
    const team = managed.length ? await supabaseRequest<StudioJob[]>(`${jobs}?club_key=in.(${managed.join(",")})&select=*&order=updated_at.desc&limit=50`) : [];
    const rows = [...own, ...team].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 50);
    const formIds = rows.map(job => job.form_registry_id).filter(Boolean);
    const archived = formIds.length ? await supabaseRequest<{ id: string }[]>(`google_forms?id=in.(${formIds.join(",")})&club_key=in.(${access.manageableClubs.join(",")})&status=eq.archived&select=id`) : [];
    const archivedIds = new Set(archived.map(form => form.id));
    return { jobs: rows.filter(job => !job.form_registry_id || !archivedIds.has(job.form_registry_id)), access, adapters: studioAdapters, aiEnabled: process.env.EVENT_AI_ENABLED === "true" };
  }
  if (action === "connection") {
    return withPersonalGoogleConnection(access.email, async () => {
      const status = await getGoogleConnectionStatus();
      return { connected: status.health === "healthy" };
    });
  }
  if (action === "limits") {
    if (!access.canSetLimits || access.readOnly) throw new StudioError("SUPER_ADMIN_REQUIRED", 403);
    const key = club(body.clubKey);
    if (key === "personal") throw new StudioError("PERSONAL_LIMITS_NOT_EDITABLE", 403);
    const actorLimit = Number(body.userDailyLimit), clubLimit = Number(body.clubDailyLimit);
    if (!Number.isInteger(actorLimit) || !Number.isInteger(clubLimit) || actorLimit < 1 || actorLimit > 100 || clubLimit < 1 || clubLimit > 1000) throw new StudioError("INVALID_AI_LIMIT");
    await supabaseRequest("event_ai_limits?on_conflict=club_key", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ club_key: key, user_daily_limit: actorLimit, club_daily_limit: clubLimit, changed_by: access.email }) });
    return { saved: true };
  }
  if (action === "usage") {
    const key = club(body.clubKey); assertStudioAccess(access, key, false);
    return { usage: await supabaseRequest(`event_ai_usage?club_key=eq.${key}${key === "personal" ? `&actor_email=eq.${encodeURIComponent(access.email)}` : ""}&select=id,requested_model,actual_model,reason,attempt,input_tokens,output_tokens,duration_ms,error_code,status,estimated_cost_usd,created_at&order=created_at.desc&limit=100`), limits: await supabaseRequest(`event_ai_limits?club_key=eq.${key}&select=club_key,user_daily_limit,club_daily_limit`) };
  }
  if (action === "plan") {
    if (typeof body.message !== "string") throw new StudioError("EVENT_REQUEST_REQUIRED");
    const key = resolveStudioClub(body.message, body.clubKey); assertStudioAccess(access, key);
    let references: { archiveId: string; historicalOnly: boolean; title: string | null; text: string }[] = [];
    if (Array.isArray(body.archiveIds) && body.archiveIds.length) {
      if (key === "personal") throw new StudioError("PRIVATE_ARCHIVE_REFERENCE_NOT_ALLOWED", 403);
      const { getArchiveAccess } = await import("@/lib/eventArchive/access");
      const { historicalReferences } = await import("@/lib/eventArchive/service");
      references = await historicalReferences(await getArchiveAccess(access.email), body.archiveIds, key);
    }
    const generated = await generateEventPlan(access.email, key, body.message, references);
    const rows = await supabaseRequest<StudioJob[]>(`${jobs}?select=*`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id: randomUUID(), club_key: key, plan: generated.plan, ai_metadata: { ...generated.metadata, formDraftVersion: 2, requestTurns: [sanitizeEventRequest(body.message)], ...(references.length ? { archiveIds: references.map(r => r.archiveId) } : {}) }, created_by: access.email }) });
    let archiveLinkPending = false;
    if (references.length) {
      const { linkArchiveReferences } = await import("@/lib/eventArchive/service");
      const { getArchiveAccess } = await import("@/lib/eventArchive/access");
      // The job is already durable; do not fail creation and provoke a duplicate
      // generation when only the secondary archive link is unavailable.
      try { await linkArchiveReferences(await getArchiveAccess(access.email), references.map(r => r.archiveId), rows[0].id); }
      catch { archiveLinkPending = true; }
    }
    return { ...await preview(rows[0], access), archiveLinkPending };
  }
  const job = await loadJob(String(body.jobId || ""), access, !["get", "review"].includes(String(action)));
  if (action === "get") return result(job, access);
  if (action === "responses") {
    if (!job.form_registry_id) throw new StudioError("FORM_REGISTRY_NOT_FOUND", 404);
    const snapshot = await result(job, access);
    if (!("form" in snapshot)) throw new StudioError("FORM_REGISTRY_NOT_FOUND", 404);
    const operation = () => syncGoogleFormResponses(snapshot.form);
    const total = job.club_key === "personal" ? await withPersonalGoogleConnection(access.email, operation) : await operation();
    const responses = await supabaseRequest<{ id: string; answers_json: Record<string, string[]>; respondent_email: string | null }[]>(`google_form_responses?google_form_registry_id=eq.${job.form_registry_id}&select=id,answers_json,respondent_email&order=submitted_at.asc&limit=1000`);
    const names = applicantNames(responses);
    return { applicants: responses.map((response, index) => ({ id: response.id, name: names[index] })), total };
  }
  if (action === "review") { assertStudioAccess(access, job.club_key); return preview(job, access); }
  if (action === "refine") {
    if (job.form_registry_id || job.state !== "draft") throw new StudioError("CREATED_JOB_CANNOT_BE_EDITED", 409);
    if (body.revision !== job.revision) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
    // Only server-saved user input supplies facts. Never promote an AI proposal or edited draft to evidence.
    const previous = job.ai_metadata.requestTurns;
    if (!Array.isArray(previous) || !previous.length || !previous.every(turn => typeof turn === "string")) throw new StudioError("EVENT_RESTART_REQUIRED", 409);
    if (typeof body.message !== "string" || !body.message.trim()) throw new StudioError("EVENT_REQUEST_REQUIRED");
    const turns = [...previous, sanitizeEventRequest(body.message.trim())];
    const request = turns.join("\n\n추가 답변 / Follow-up answer:\n");
    if (turns.length > 8 || request.length > 6000) throw new StudioError("EVENT_CONVERSATION_LIMIT", 400);
    let references: object[] = [];
    if (Array.isArray(job.ai_metadata.archiveIds) && job.ai_metadata.archiveIds.length) {
      const { getArchiveAccess } = await import("@/lib/eventArchive/access");
      const { historicalReferences } = await import("@/lib/eventArchive/service");
      references = await historicalReferences(await getArchiveAccess(access.email), job.ai_metadata.archiveIds, job.club_key);
    }
    const storedReference = typeof job.ai_metadata.scheduleReference === "string" ? Date.parse(job.ai_metadata.scheduleReference) : NaN;
    const generated = await generateEventPlan(access.email, job.club_key, request, references, Number.isFinite(storedReference) ? new Date(storedReference) : new Date());
    const updated = await supabaseRequest<StudioJob[]>(`${jobQuery(job.id)}&revision=eq.${job.revision}&state=eq.draft&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ plan: generated.plan, ai_metadata: { ...job.ai_metadata, ...generated.metadata, requestTurns: turns }, revision: job.revision + 1, updated_at: new Date().toISOString() }) });
    if (!updated[0]) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
    return preview(updated[0], access);
  }
  if (action === "update") {
    if (job.form_registry_id || job.state !== "draft") throw new StudioError("CREATED_JOB_CANNOT_BE_EDITED", 409);
    if (body.revision !== job.revision) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
    const plan = parseEventPlan(body.plan, job.club_key);
    const updated = await supabaseRequest<StudioJob[]>(`${jobQuery(job.id)}&revision=eq.${job.revision}&state=eq.draft&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ plan, revision: job.revision + 1, updated_at: new Date().toISOString() }) });
    if (!updated[0]) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
    return preview(updated[0], access);
  }
  if (action === "recover") {
    if (job.state !== "running" || Date.now() - Date.parse(job.updated_at) < 180000) throw new StudioError("JOB_RUNNING_WAIT", 409);
    const attempts = await supabaseRequest<{ remote_form_id: string | null; status: string }[]>(`google_form_creation_attempts?idempotency_key=eq.studio_${job.id}&select=remote_form_id,status&limit=1`);
    // If a remote create may have happened, never issue another create blindly.
    if (attempts[0] && !attempts[0].remote_form_id) throw new StudioError("FORM_CREATION_UNCERTAIN_RECONCILIATION_REQUIRED", 409);
    const updated = await supabaseRequest<StudioJob[]>(`${jobQuery(job.id)}&state=eq.running&updated_at=eq.${encodeURIComponent(job.updated_at)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ state: "failed", last_error: "RECOVERED_REVIEW_REQUIRED", updated_at: new Date().toISOString() }) });
    if (!updated[0]) throw new StudioError("JOB_CHANGED_REVIEW_AGAIN", 409);
    return preview(updated[0], access);
  }
  if (action === "approve") {
    if (body.confirmed !== true || typeof body.token !== "string" || body.token.length > 30000) throw new StudioError("EXPLICIT_APPROVAL_REQUIRED", 403);
    let approval: Approval;
    try { approval = verifySignedWoohyukmonPayload(body.token) as Approval; } catch { throw new StudioError("INVALID_APPROVAL", 403); }
    if (approval.namespace !== "event_studio_v1" || approval.actor !== access.email || approval.club !== job.club_key || approval.job !== job.id || approval.revision !== job.revision || approval.hash !== hash(job.plan) || !Number.isFinite(approval.expires) || approval.expires <= Date.now()) throw new StudioError("APPROVAL_EXPIRED_OR_CHANGED", 409);
    return job.club_key === "personal" ? withPersonalGoogleConnection(access.email, () => execute(job, access)) : execute(job, access);
  }
  throw new StudioError("UNKNOWN_STUDIO_ACTION");
}
