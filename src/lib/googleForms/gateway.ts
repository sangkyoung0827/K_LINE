import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertClubAccess, getGoogleFormsAccess, GoogleFormsAuthorizationError } from "./access";
import { createGoogleForm, registryColumns, setGoogleFormStatus, syncGoogleFormResponses } from "./googleApi";
import { googleFormsActionRegistry, generateActivityNotice, noticeWithFormUrl, planActivity, type GoogleFormsAction } from "./planning";
import { parseGoogleFormDraft } from "./validation";
import { assertGoogleFormsNoticePublicationApproval } from "./safety";
import { withCurrentGatheringDays } from "./gathering";
import { planNewActivity } from "./aiPlanning";
import type { GoogleFormDraft, GoogleFormRegistryRow } from "./types";
import { cleanText } from "@/lib/supabaseServer";
import { supabaseRequest } from "./store";
import { createSignedWoohyukmonPayload, verifySignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";

type Workflow = {
  id: string; club_key: GoogleFormDraft["clubKey"]; draft: GoogleFormDraft; notice: string;
  revision: number; workflow_status: string; form_registry_id: string | null; notice_id: string | null;
  last_error: string | null; created_by: string;
};
type Approval = { namespace: "google_forms_v5"; actorEmail: string; workflowId: string; revision: number; formRevision?: string; action: GoogleFormsAction; expiresAt: number };
type Command = { action?: unknown; message?: unknown; workflowId?: unknown; formId?: unknown; draft?: unknown; notice?: unknown; token?: unknown };
const query = (id: string) => `google_form_workflows?id=eq.${encodeURIComponent(id)}`;
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function audit(actor: string, action: string, outcome: string, workflowId?: string) {
  await supabaseRequest("google_form_operation_audit", { method: "POST", body: JSON.stringify({ actor_email: actor, action, outcome, workflow_id: workflowId || null }) });
}
async function getWorkflow(id: string) {
  const rows = await supabaseRequest<Workflow[]>(`${query(id)}&select=*&limit=1`, { cache: "no-store" });
  if (!rows[0]) throw new Error("WORKFLOW_NOT_FOUND");
  return rows[0];
}
function preview(workflow: Workflow, actorEmail: string) {
  const payload: Approval = { namespace: "google_forms_v5", actorEmail, workflowId: workflow.id, revision: workflow.revision,
    action: "CREATE_ACTIVITY_WITH_FORM_AND_NOTICE", expiresAt: Date.now() + 600_000 };
  return reply({ handled: true, kind: "answer", title: "Google Forms · 승인 전 미리보기", workflow,
    token: createSignedWoohyukmonPayload(payload), summary: workflow.notice,
    rows: workflow.draft.questions.map((question) => ({ 질문: question.title, 유형: question.type, 필수: question.required, 보기: question.options.join(" / ") })) });
}
async function execute(workflow: Workflow, actor: string) {
  if (["notice_saved", "notice_published"].includes(workflow.workflow_status)) return workflow;
  if (workflow.workflow_status === "running") throw new Error("WORKFLOW_ALREADY_RUNNING_RECONCILE_BEFORE_RETRY");
  const locked = await supabaseRequest<Workflow[]>(`${query(workflow.id)}&revision=eq.${workflow.revision}&workflow_status=eq.${workflow.workflow_status}&select=*`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ workflow_status: "running", last_retry_at: new Date().toISOString(), last_error: null }) });
  if (!locked[0]) throw new Error("WORKFLOW_CHANGED_REVIEW_AGAIN");
  try {
    await audit(actor, "CREATE_ACTIVITY_WITH_FORM_AND_NOTICE", "started", workflow.id);
    const form = await createGoogleForm(workflow.draft, workflow.created_by, workflow.id);
    await supabaseRequest(query(workflow.id), { method: "PATCH", body: JSON.stringify({ form_registry_id: form.id }) });
    const content = noticeWithFormUrl(workflow.notice, form.responder_url);
    if (workflow.club_key !== "ecc") throw new Error("NOTICE_ADAPTER_PENDING_FOR_THIS_CLUB");
    // Same ECC board schema; private draft only in the isolated test database.
    await supabaseRequest("club_board_posts?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({
      id: workflow.id, board_id: "ecc", title: workflow.draft.title, content, author_name: actor, status: "draft", media: [] }) });
    const notices = await supabaseRequest<Array<{ id: string; status: string }>>(`club_board_posts?select=id,status&id=eq.${workflow.id}&limit=1`, { cache: "no-store" });
    if (notices[0]?.status !== "draft") throw new Error("PRIVATE_NOTICE_SAVE_NOT_CONFIRMED");
    await supabaseRequest(query(workflow.id), { method: "PATCH", body: JSON.stringify({ workflow_status: "notice_saved", notice_id: workflow.id }) });
    await audit(actor, "CREATE_ACTIVITY_WITH_FORM_AND_NOTICE", "private_notice_saved", workflow.id);
    return getWorkflow(workflow.id);
  } catch (error) {
    await supabaseRequest(query(workflow.id), { method: "PATCH", body: JSON.stringify({ workflow_status: "failed", last_error: error instanceof Error ? error.message : "WORKFLOW_FAILED" }) }).catch(() => undefined);
    await audit(actor, "CREATE_ACTIVITY_WITH_FORM_AND_NOTICE", "failed", workflow.id).catch(() => undefined);
    throw error;
  }
}

async function publishTestNotice(workflow: Workflow, actor: string) {
  assertGoogleFormsNoticePublicationApproval();
  if (workflow.club_key !== "ecc" || !workflow.form_registry_id || !workflow.notice_id || !["notice_saved", "notice_published"].includes(workflow.workflow_status)) throw new Error("NOTICE_NOT_READY");
  const forms = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${workflow.form_registry_id}&limit=1`, { cache: "no-store" });
  if (forms[0]?.status !== "open") throw new Error("FORM_NOT_OPEN_FOR_RESPONDENTS");
  await audit(actor, "PUBLISH_ACTIVITY_NOTICE", "started", workflow.id);
  await supabaseRequest(`club_board_posts?id=eq.${workflow.notice_id}&board_id=eq.ecc`, { method: "PATCH", body: JSON.stringify({ status: "published", content: noticeWithFormUrl(workflow.notice, forms[0].responder_url) }) });
  const notices = await supabaseRequest<Array<{ status: string }>>(`club_board_posts?id=eq.${workflow.notice_id}&board_id=eq.ecc&select=status&limit=1`, { cache: "no-store" });
  if (notices[0]?.status !== "published") throw new Error("NOTICE_PUBLICATION_NOT_CONFIRMED");
  await supabaseRequest(query(workflow.id), { method: "PATCH", body: JSON.stringify({ workflow_status: "notice_published", published_at: new Date().toISOString() }) });
  await audit(actor, "PUBLISH_ACTIVITY_NOTICE", "completed", workflow.id);
  return getWorkflow(workflow.id);
}

export async function handleGoogleFormsOperation(body: Command): Promise<NextResponse | null> {
  const action = cleanText(body.action, 80);
  const message = cleanText(body.message, 5000);
  const recognized = Object.hasOwn(googleFormsActionRegistry, action) || action === "confirm_google_forms" || action === "list_google_form_workflows";
  const naturalCommand = /(google\s*forms?|구글\s*폼|\bform\b|폼)/i.test(message) && /create|make|draft|design|만들|작성|생성|설계/i.test(message);
  if (!recognized && (!naturalCommand || process.env.GOOGLE_FORMS_AUTOMATION_ENABLED !== "true")) return null;
  try {
    const access = await getGoogleFormsAccess();
    if (!access.authenticated) throw new GoogleFormsAuthorizationError("LOGIN_REQUIRED", 401);
    if (!access.manageableClubs.length) throw new GoogleFormsAuthorizationError("FORBIDDEN", 403);
    if (action === "list_google_form_workflows") return reply({ workflows: await supabaseRequest<Workflow[]>(`google_form_workflows?select=*&club_key=in.(${access.manageableClubs.join(",")})&order=created_at.desc&limit=100`, { cache: "no-store" }) });
    if (action === "confirm_google_forms") {
      const approval = verifySignedWoohyukmonPayload(cleanText(body.token, 30_000)) as Approval;
      if (approval.namespace !== "google_forms_v5" || approval.actorEmail !== access.email || !Number.isFinite(approval.expiresAt) || approval.expiresAt <= Date.now()) throw new Error("INVALID_OR_EXPIRED_APPROVAL");
      if (approval.action === "OPEN_FORM_RECRUITMENT" || approval.action === "CLOSE_FORM_RECRUITMENT") {
        const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${encodeURIComponent(approval.workflowId)}&limit=1`, { cache: "no-store" });
        if (!rows[0]) throw new Error("FORM_NOT_FOUND");
        assertClubAccess(access, rows[0].club_key, true);
        if (rows[0].updated_at !== approval.formRevision) throw new Error("FORM_CHANGED_REVIEW_AGAIN");
        await audit(access.email, approval.action, "started");
        const form = await setGoogleFormStatus(rows[0], approval.action === "OPEN_FORM_RECRUITMENT" ? "open" : "closed");
        await audit(access.email, approval.action, "completed");
        return reply({ handled: true, kind: "result", title: "모집 상태 변경", succeeded: 1, failed: 0, form });
      }
      const workflow = await getWorkflow(approval.workflowId);
      assertClubAccess(access, workflow.club_key, true);
      if (approval.action === "PUBLISH_ACTIVITY_NOTICE") {
        if (approval.revision !== workflow.revision) throw new Error("WORKFLOW_CHANGED_REVIEW_AGAIN");
        return reply({ handled: true, kind: "result", title: "테스트 공지 게시 확인", succeeded: 1, failed: 0, workflow: await publishTestNotice(workflow, access.email) });
      }
      if (approval.revision !== workflow.revision || approval.action !== "CREATE_ACTIVITY_WITH_FORM_AND_NOTICE") throw new Error("WORKFLOW_CHANGED_REVIEW_AGAIN");
      const completed = await execute(workflow, access.email);
      const forms = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${completed.form_registry_id}&limit=1`, { cache: "no-store" });
      if (!forms[0]) throw new Error("FORM_NOT_FOUND");
      return reply({ handled: true, kind: "result", title: "비공개 테스트 작업 완료", summary: "비공개 Google Form과 테스트 공지 초안이 저장되었습니다. 운영 게시·배포는 하지 않았습니다.", succeeded: 1, failed: 0, workflow: completed, form: forms[0], notice: noticeWithFormUrl(completed.notice, forms[0].responder_url) });
    }
    if (action === "DRAFT_GOOGLE_FORM" || action === "GENERATE_ACTIVITY_NOTICE" || (!recognized && message)) {
      let planned = body.draft ? { draft: parseGoogleFormDraft(body.draft), missing: [] } : planActivity(message);
      assertClubAccess(access, planned.draft.clubKey, true);
      if (!body.draft && !planned.draft.activityTitle) planned = await planNewActivity(message);
      if (planned.missing.length) return reply({ handled: true, kind: "answer", title: "추가 정보가 필요합니다", summary: planned.missing.join("\n"), draft: planned.draft, missing: planned.missing });
      const draft = await withCurrentGatheringDays(parseGoogleFormDraft(planned.draft));
      const workflows = await supabaseRequest<Workflow[]>("google_form_workflows?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ id: randomUUID(), club_key: draft.clubKey, draft, notice: generateActivityNotice(draft), created_by: access.email }) });
      await audit(access.email, "DRAFT_GOOGLE_FORM", "saved", workflows[0].id);
      return preview(workflows[0], access.email);
    }
    if (["GET_GOOGLE_FORM", "READ_FORM_RESPONSE_COUNT", "READ_FORM_RESPONSE_SUMMARY", "SYNC_GOOGLE_FORM_RESPONSES", "OPEN_FORM_RECRUITMENT", "CLOSE_FORM_RECRUITMENT"].includes(action)) {
      const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&id=eq.${encodeURIComponent(cleanText(body.formId, 100))}&limit=1`, { cache: "no-store" });
      if (!rows[0]) throw new Error("FORM_NOT_FOUND");
      const form = rows[0];
      assertClubAccess(access, form.club_key, googleFormsActionRegistry[action as GoogleFormsAction].write);
      if (action === "SYNC_GOOGLE_FORM_RESPONSES") { await audit(access.email, action, "started"); return reply({ count: await syncGoogleFormResponses(form) }); }
      if (action === "OPEN_FORM_RECRUITMENT" || action === "CLOSE_FORM_RECRUITMENT") {
        const approval: Approval = { namespace: "google_forms_v5", actorEmail: access.email, workflowId: form.id, revision: 0,
          formRevision: form.updated_at, action, expiresAt: Date.now() + 600_000 };
        return reply({ handled: true, kind: "answer", title: "모집 변경 승인 필요", form, token: createSignedWoohyukmonPayload(approval) });
      }
      if (action === "READ_FORM_RESPONSE_SUMMARY") return reply({ responses: await supabaseRequest(`google_form_responses?select=id,submitted_at,respondent_email,answers_json&google_form_registry_id=eq.${form.id}&order=submitted_at.asc`) });
      return reply({ form, count: form.response_count });
    }
    const workflow = await getWorkflow(cleanText(body.workflowId, 100));
    assertClubAccess(access, workflow.club_key, googleFormsActionRegistry[action as GoogleFormsAction]?.write === true);
    if (action === "PUBLISH_ACTIVITY_NOTICE") {
      assertGoogleFormsNoticePublicationApproval();
      const approval: Approval = { namespace: "google_forms_v5", actorEmail: access.email, workflowId: workflow.id, revision: workflow.revision, action, expiresAt: Date.now() + 600_000 };
      return reply({ handled: true, kind: "answer", title: "테스트 공지 게시 승인 필요", workflow, token: createSignedWoohyukmonPayload(approval) });
    }
    if (action === "UPDATE_GOOGLE_FORM_DRAFT" || action === "UPDATE_ACTIVITY_NOTICE") {
      if (workflow.form_registry_id || !["draft", "failed"].includes(workflow.workflow_status)) throw new Error("CREATED_FORM_CANNOT_BE_EDITED_AS_DRAFT");
      const draft = body.draft ? parseGoogleFormDraft(body.draft) : workflow.draft;
      if (draft.clubKey !== workflow.club_key) throw new Error("WORKFLOW_CLUB_CANNOT_CHANGE");
      const notice = body.notice === undefined ? workflow.notice : cleanText(body.notice, 20_000);
      if (!notice.includes("{{GOOGLE_FORM_URL}}")) throw new Error("NOTICE_FORM_LINK_PLACEHOLDER_REQUIRED");
      const updated = await supabaseRequest<Workflow[]>(`${query(workflow.id)}&revision=eq.${workflow.revision}&workflow_status=eq.${workflow.workflow_status}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ draft, notice, revision: workflow.revision + 1 }) });
      if (!updated[0]) throw new Error("WORKFLOW_CHANGED_REVIEW_AGAIN");
      await audit(access.email, action, "saved", workflow.id);
      return preview(updated[0], access.email);
    }
    return preview(workflow, access.email);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "GOOGLE_FORMS_OPERATION_FAILED" }, error instanceof GoogleFormsAuthorizationError ? error.status : 400);
  }
}
