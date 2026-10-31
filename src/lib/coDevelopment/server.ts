import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getSupabaseConfig } from "@/lib/supabaseServer";
import { canUseCoDevelopment, isLabOwner, defaultLabAppearance, LabError, labAppearance, labCollection, labData, labId, labRecordData, labSave, labSources, labVersion, type LabProject, type LabRevision, type LabState, type LabSettings, type LabRecord, type LabRecords, type LabReviewDetail, type PublishedLab } from "./model";
import type { LabOwnerProject, LabOwnerDetail } from "./model";
import { labOAuthVerify } from "./oauth-store";

export type LabActor = { email: string; via: "session" | "token" | "oauth" };
type Actor = LabActor;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const procedures = new Set(["list", "get", "revision", "save", "state_read", "state_save", "review", "token_lookup", "token_rotate", "token_revoke", "settings_get", "settings_save", "bundle_save", "source_get", "records_list", "record_save", "review_queue", "review_detail", "review_decide", "release", "catalog", "public_revision", "service_data"]);

function ownerSession(actor: Actor) {
  if (actor.via !== "session" || !isLabOwner(actor.email)) throw new LabError("LAB_FORBIDDEN",403);
}
const projectColumns="id,title,description,revision,review_state,created_by,updated_by,created_at,updated_at";
const revisionColumns="id,project_id,revision,title,description,created_by,created_at";
// Read-only oversight of lab artifacts, never operational club tables or author runtime records.
async function ownerRead<T>(actor: Actor, table: "co_dev_projects"|"co_dev_revisions"|"co_dev_sources", query: URLSearchParams): Promise<T[]> {
  ownerSession(actor);
  const config=getSupabaseConfig();
  const response=await fetch(`${config.url}/rest/v1/${table}?${query}`,{method:"GET",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`}});
  if(!response.ok) throw new LabError("LAB_STORAGE_UNAVAILABLE",503);
  return response.json() as Promise<T[]>;
}
export async function labOwnerRevision(actor: Actor, revisionId: string) {
  ownerSession(actor);
  const rows=await ownerRead<LabRevision>(actor,"co_dev_revisions",new URLSearchParams({select:"*",id:`eq.${labId(revisionId)}`,limit:"1"}));
  if(!rows[0])throw new LabError("NOT_FOUND",404);
  return rows[0];
}

// This transport cannot address any existing K_LINE table or production RPC.
async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!procedures.has(name)) throw new LabError("INVALID_OPERATION");
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/co_dev_${name}`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message = typeof detail.message === "string" ? detail.message : "";
    for (const code of ["REVISION_CONFLICT", "STATE_CONFLICT", "SETTINGS_CONFLICT", "RECORD_CONFLICT", "NOT_FOUND", "RATE_LIMITED", "PROJECT_LIMIT", "LAB_FORBIDDEN", "REVIEW_REQUIRED", "REVIEW_NOTE_REQUIRED"]) {
      if (message.includes(code)) throw new LabError(code, code.includes("CONFLICT") ? 409 : code === "NOT_FOUND" ? 404 : code === "LAB_FORBIDDEN" ? 403 : ["RATE_LIMITED", "PROJECT_LIMIT"].includes(code) ? 429 : 400);
    }
    throw new LabError("LAB_STORAGE_UNAVAILABLE", 503);
  }
  return response.json() as Promise<T>;
}

export async function labActor(request: Request, sessionOnly = false): Promise<Actor> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    if (!sessionOnly && new URL(request.url).pathname === "/api/co-development/mcp" && bearer.startsWith("Bearer kla_")) {
      const row = await labOAuthVerify(request, bearer.slice(7));
      if (!canUseCoDevelopment(row.email)) throw new LabError("LAB_FORBIDDEN", 403);
      return { email: row.email, via: "oauth" };
    }
    if (sessionOnly || !/^Bearer kll_[a-f0-9]{64}$/.test(bearer)) throw new LabError("LAB_FORBIDDEN", 403);
    const row = await rpc<{ email: string } | null>("token_lookup", { p_hash: hash(bearer.slice(7)) });
    if (!row || !canUseCoDevelopment(row.email)) throw new LabError("LAB_FORBIDDEN", 403);
    return { email: row.email, via: "token" };
  }
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!canUseCoDevelopment(email)) throw new LabError("LAB_FORBIDDEN", email ? 403 : 401);
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new LabError("INVALID_ORIGIN", 403);
  }
  return { email: email!, via: "session" };
}

export async function labCommand(actor: Actor, body: Record<string, unknown>) {
  const args = { p_actor: actor.email };
  switch (body.action) {
    case "owner_projects": {
      ownerSession(actor);
      const query=new URLSearchParams({select:projectColumns,order:"id.asc",limit:"51"});
      if(body.after)query.set("id",`gt.${labId(body.after)}`);
      const rows=await ownerRead<LabOwnerProject>(actor,"co_dev_projects",query);
      return {projects:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null};
    }
    case "owner_project": {
      ownerSession(actor);
      const id=labId(body.id);
      const projects=await ownerRead<LabOwnerProject>(actor,"co_dev_projects",new URLSearchParams({select:projectColumns,id:`eq.${id}`,limit:"1"}));
      if(!projects[0])throw new LabError("NOT_FOUND",404);
      const revisions=await ownerRead<LabOwnerDetail["revisions"][number]>(actor,"co_dev_revisions",new URLSearchParams({select:revisionColumns,project_id:`eq.${id}`,order:"revision.desc",limit:"100"}));
      const target=body.revisionId?labId(body.revisionId):revisions[0]?.id;
      if(!target||!revisions.some(r=>r.id===target))throw new LabError("NOT_FOUND",404);
      const revision=await labOwnerRevision(actor,target);
      const sources=await ownerRead<{files:Record<string,string>;source_hash:string}>(actor,"co_dev_sources",new URLSearchParams({select:"files,source_hash",revision_id:`eq.${target}`,limit:"1"}));
      return {project:projects[0],revisions,revision,source:sources[0]?{files:sources[0].files,sourceHash:sources[0].source_hash}:null} satisfies LabOwnerDetail;
    }
    case "review_queue":
    case "review_detail":
    case "review_decide":
    case "release": {
      ownerSession(actor);
      if (body.action === "review_queue") return rpc("review_queue", args);
      const p_id = labId(body.id);
      if (body.action === "review_detail") return rpc<LabReviewDetail>("review_detail", { ...args, p_id });
      if (body.action === "review_decide") {
        if (typeof body.approve !== "boolean" || typeof body.note !== "string" || !body.note.trim() || body.note.length > 2000) throw new LabError("REVIEW_NOTE_REQUIRED");
        return rpc("review_decide", { ...args, p_id, p_approve: body.approve, p_note: body.note.trim() });
      }
      if (typeof body.publish !== "boolean") throw new LabError("INVALID_BODY");
      return rpc("release", { ...args, p_id, p_expected: labVersion(body.expectedVersion), p_publish: body.publish });
    }
    case "settings_get": {
      const settings = await rpc<LabSettings | null>("settings_get", args);
      return settings || { appearance: defaultLabAppearance, version: 0 };
    }
    case "settings_save": return rpc<LabSettings>("settings_save", { ...args, p_expected: labVersion(body.expectedVersion), p_appearance: labAppearance(body.appearance) });
    case "list": return { projects: await rpc<LabProject[]>("list", args) };
    case "get": return rpc<{ project: LabProject; revisions: LabRevision[] }>("get", { ...args, p_id: labId(body.id) });
    case "revision": return { revision: await rpc<LabRevision>("revision", { ...args, p_revision: labId(body.revisionId) }) };
    case "save":
    case "bundle_save": {
      const value = labSave(body, randomUUID());
      const saveArgs = { ...args, p_id: value.id, p_expected: value.expectedRevision, p_title: value.title, p_description: value.description, p_html: value.html, p_fixture: value.fixture };
      if (body.action === "save") return { project: await rpc<LabProject>("save", saveArgs) };
      const files = labSources(body.files);
      const digest = createHash("sha256").update(JSON.stringify(files)).digest("hex");
      return rpc<{ project: LabProject; sourceHash: string }>("bundle_save", { ...saveArgs, p_files: files, p_hash: digest });
    }
    case "source_get": return rpc("source_get", { ...args, p_revision: labId(body.revisionId) });
    case "records_list": {
      const limit = body.limit === undefined ? 50 : labVersion(body.limit);
      if (limit < 1 || limit > 100 || (body.includeArchived !== undefined && typeof body.includeArchived !== "boolean")) throw new LabError("INVALID_BODY");
      return rpc<LabRecords>("records_list", { ...args, p_project: labId(body.projectId), p_collection: labCollection(body.collection), p_after: body.after ? labId(body.after) : null, p_limit: limit, p_archived: body.includeArchived === true });
    }
    case "record_save": {
      if (body.archived !== undefined && typeof body.archived !== "boolean") throw new LabError("INVALID_BODY");
      return rpc<LabRecord>("record_save", { ...args, p_project: labId(body.projectId), p_collection: labCollection(body.collection), p_id: labId(body.id), p_data: labRecordData(body.data), p_expected: labVersion(body.expectedVersion), p_archived: body.archived === true });
    }
    case "state_read":
    case "state_save": {
      if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
      const stateArgs = { ...args, p_revision: labId(body.revisionId) };
      return body.action === "state_read" ? rpc<LabState>("state_read", stateArgs) : rpc<LabState>("state_save", { ...stateArgs, p_data: labData(body.data), p_expected: labVersion(body.expectedVersion) });
    }
    case "review": {
      if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
      return { project: await rpc<LabProject>("review", { ...args, p_id: labId(body.id), p_expected: labVersion(body.expectedRevision) }) };
    }
    case "token_rotate": {
      if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
      const token = `kll_${randomBytes(32).toString("hex")}`;
      const result = await rpc<{ expires_at: string }>("token_rotate", { ...args, p_hash: hash(token) });
      return { token, expiresAt: result.expires_at };
    }
    case "token_revoke": {
      if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
      await rpc("token_revoke", args); return { revoked: true };
    }
    default: throw new LabError("INVALID_OPERATION");
  }
}

export async function labPreview(actor: Actor, revisionId: string) {
  if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
  return rpc<LabRevision>("revision", { p_actor: actor.email, p_revision: labId(revisionId) });
}

export async function labCatalog() { return rpc<PublishedLab[]>("catalog", {}); }
export async function labPublicRevision(id: string) {
  const value = await rpc<{ id: string; title: string; html: string; revision: number } | null>("public_revision", { p_id: labId(id) });
  if (!value) throw new LabError("NOT_FOUND", 404);
  return value;
}
export async function labServiceData(actor: Actor, projectId: string, input: Record<string, unknown>) {
  if (actor.via !== "session") throw new LabError("LAB_FORBIDDEN", 403);
  const action = String(input.action);
  const payload: Record<string, unknown> = {};
  if (!["state_read", "state_save", "records_list", "record_save"].includes(action)) throw new LabError("INVALID_OPERATION");
  if (action === "records_list" || action === "record_save") payload.collection = labCollection(input.collection);
  if (action === "records_list") {
    const limit = input.limit === undefined ? 50 : labVersion(input.limit);
    if (limit < 1 || limit > 100 || (input.includeArchived !== undefined && typeof input.includeArchived !== "boolean")) throw new LabError("INVALID_BODY");
    Object.assign(payload, { limit, after: input.after ? labId(input.after) : null, includeArchived: input.includeArchived === true });
  }
  if (action === "state_save" || action === "record_save") {
    payload.data = action === "state_save" ? labData(input.data) : labRecordData(input.data);
    payload.expectedVersion = labVersion(input.expectedVersion);
    if (action === "record_save") {
      payload.id = labId(input.id);
      if (input.archived !== undefined && typeof input.archived !== "boolean") throw new LabError("INVALID_BODY");
      payload.archived = input.archived === true;
    }
  }
  return rpc("service_data", { p_actor: actor.email, p_project: labId(projectId), p_action: action, p_payload: payload });
}
