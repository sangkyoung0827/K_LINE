import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getSupabaseConfig } from "@/lib/supabaseServer";
import { canUseCoDevelopment, defaultLabAppearance, LabError, labAppearance, labCollection, labData, labId, labRecordData, labSave, labSources, labVersion, type LabProject, type LabRevision, type LabState, type LabSettings, type LabRecord, type LabRecords } from "./model";

export type LabActor = { email: string; via: "session" | "token" };
type Actor = LabActor;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const procedures = new Set(["list", "get", "revision", "save", "state_read", "state_save", "review", "token_lookup", "token_rotate", "token_revoke", "settings_get", "settings_save", "bundle_save", "source_get", "records_list", "record_save"]);

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
    for (const code of ["REVISION_CONFLICT", "STATE_CONFLICT", "SETTINGS_CONFLICT", "RECORD_CONFLICT", "NOT_FOUND", "RATE_LIMITED", "PROJECT_LIMIT", "LAB_FORBIDDEN"]) {
      if (message.includes(code)) throw new LabError(code, code.includes("CONFLICT") ? 409 : code === "NOT_FOUND" ? 404 : code === "LAB_FORBIDDEN" ? 403 : 429);
    }
    throw new LabError("LAB_STORAGE_UNAVAILABLE", 503);
  }
  return response.json() as Promise<T>;
}

export async function labActor(request: Request, sessionOnly = false): Promise<Actor> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
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
