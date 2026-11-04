import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { getSupabaseConfig, SupabaseRequestError } from "@/lib/supabaseServer";
import { isReadOnlyDeveloperEmail } from "@/lib/readOnlyDeveloper";
import { AppError, uuid, canReadMemory } from "./model";

export type Actor = {
  id: string;
  email: string;
  name: string;
  readOnly: boolean;
};
export type EventRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  description_en: string;
  starts_at: string;
  ends_at: string;
  location: string;
  online: boolean;
  capacity: number | null;
  waitlist: boolean;
  approval: string;
  visibility: string;
  status: string;
  revision: number;
  applications_open_at: string;
  applications_close_at: string;
  questions: import("./model").Question[];
  created_by: string;
  memories_enabled: boolean;
};
export type MemoryRow = {
  id: string;
  event_id: string;
  owner_id: string;
  title: string;
  body: string;
  visibility: string;
  status: string;
  created_at: string;
  photo_consent: boolean;
};
const allowedTables = new Set([
  "organizations",
  "organization_members",
  "events",
  "event_admin_roles",
  "applications",
  "attendance",
  "memories",
  "memory_assets",
  "announcements",
  "ai_generations",
  "audit",
  "mobile_grants",
  "mobile_sessions",
  "reports",
  "blocks",
  "deletion_requests",
]);
const allowedRPCs = new Set(["is_manager", "exchange_grant", "command"]);
export function requireAppEnabled() {
  if (process.env.WOOHYUKMON_APP_ENABLED !== "true")
    throw new AppError("APP_NOT_ENABLED", 503);
}
export function dbConfig() {
  const stagingUrl = process.env.WOOHYUKMON_APP_DB_URL?.trim();
  const stagingKey = process.env.WOOHYUKMON_APP_DB_SERVICE_KEY?.trim();
  if (Boolean(stagingUrl) !== Boolean(stagingKey))
    throw new AppError("APP_DATABASE_CONFIGURATION_INVALID", 503);
  return stagingUrl && stagingKey
    ? { url: stagingUrl.replace(/\/+$/, ""), serviceRoleKey: stagingKey }
    : getSupabaseConfig();
}
export async function appDB<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  requireAppEnabled();
  const resource = path.split("?")[0];
  if (!(
    (resource.startsWith("woo_v1_") && allowedTables.has(resource.slice(7))) ||
    (resource.startsWith("rpc/woo_v1_") && allowedRPCs.has(resource.slice(11)))
  ))
    throw new AppError("UNSAFE_APP_RESOURCE", 500);
  const config = dbConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("Authorization", `Bearer ${config.serviceRoleKey}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers,
    signal: init.signal || AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new SupabaseRequestError(await response.text(), response.status);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
export function secret() {
  return randomBytes(32).toString("base64url");
}
export async function memberBy(
  field: "id" | "email",
  value: string,
): Promise<Actor> {
  // Identity is read from the existing K_LINE table, not recreated in the new namespace.
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "id,email,name,status",
    [field]: `eq.${value}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/site_members?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new AppError("IDENTITY_LOOKUP_UNAVAILABLE", 503);
  const rows = await response.json();
  const row = rows[0];
  if (!row || row.status !== "active")
    throw new AppError("LOGIN_REQUIRED", 401);
  return {
    id: uuid(row.id),
    email: String(row.email).toLowerCase(),
    name: String(row.name || ""),
    readOnly: isReadOnlyDeveloperEmail(row.email),
  };
}
export async function getActor(
  request: Request,
  required = true,
): Promise<Actor | null> {
  requireAppEnabled();
  const header = request.headers.get("authorization");
  let actor: Actor | null = null;
  if (header !== null) {
    if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))
      throw new AppError("SESSION_EXPIRED", 401);
    const rows = await appDB<
      { member_id: string; expires_at: string; revoked_at: string | null }[]
    >(
      `woo_v1_mobile_sessions?token_hash=eq.${digest(header.slice(7))}&select=member_id,expires_at,revoked_at&limit=1`,
    );
    if (
      !rows[0] ||
      rows[0].revoked_at ||
      Date.parse(rows[0].expires_at) <= Date.now()
    )
      throw new AppError("SESSION_EXPIRED", 401);
    actor = await memberBy("id", rows[0].member_id);
  } else {
    const session = await auth();
    if (session?.user?.email)
      actor = await memberBy("email", session.user.email.trim().toLowerCase());
  }
  if (required && !actor) throw new AppError("LOGIN_REQUIRED", 401);
  if (actor) {
    const requests = await appDB<{ id: string }[]>(
      `woo_v1_deletion_requests?member_id=eq.${actor.id}&status=in.(pending,processing)&select=id&limit=1`,
    );
    if (requests.length) throw new AppError("DELETION_PENDING", 403);
  }
  return actor;
}
export function requireWrite(actor: Actor, request: Request, ownSessionOnly = false) {
  if (actor.readOnly && !ownSessionOnly) throw new AppError("READ_ONLY_ACCOUNT", 403);
  if (!request.headers.has("authorization")) {
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin)
      throw new AppError("INVALID_ORIGIN", 403);
  }
}
export async function manager(
  actor: Actor,
  eventId: string,
  ownerOnly = false,
) {
  return appDB<boolean>("rpc/woo_v1_is_manager", {
    method: "POST",
    body: JSON.stringify({
      p_actor: actor.id,
      p_event: uuid(eventId),
      p_owner_only: ownerOnly,
    }),
  });
}
export async function getEvent(
  eventId: string,
  actor: Actor | null,
): Promise<EventRow> {
  const rows = await appDB<EventRow[]>(
    `woo_v1_events?id=eq.${uuid(eventId)}&limit=1`,
  );
  const event = rows[0];
  if (!event) throw new AppError("NOT_FOUND", 404);
  if (actor && (await manager(actor, event.id))) return event;
  if (event.status === "draft") throw new AppError("NOT_FOUND", 404);
  if (event.visibility === "members") {
    if (!actor) throw new AppError("NOT_FOUND", 404);
    const memberships = await appDB<{ member_id: string }[]>(
      `woo_v1_organization_members?organization_id=eq.${event.organization_id}&member_id=eq.${actor.id}&limit=1`,
    );
    if (!memberships.length) throw new AppError("NOT_FOUND", 404);
  }
  return event;
}
export async function accessibleMemory(
  id: string,
  actor: Actor | null,
): Promise<MemoryRow> {
  const rows = await appDB<MemoryRow[]>(
    `woo_v1_memories?id=eq.${uuid(id)}&limit=1`,
  );
  const m = rows[0];
  if (!m) throw new AppError("NOT_FOUND", 404);
  const event = await getEvent(m.event_id, actor);
  const isManager = actor ? await manager(actor, event.id) : false;
  const attended = actor
    ? (
        await appDB<unknown[]>(
          `woo_v1_attendance?event_id=eq.${event.id}&member_id=eq.${actor.id}&limit=1`,
        )
      ).length > 0
    : false;
  const blocked = actor
    ? (
        await appDB<unknown[]>(
          `woo_v1_blocks?member_id=eq.${actor.id}&blocked_id=eq.${m.owner_id}&limit=1`,
        )
      ).length > 0
    : false;
  if (
    !canReadMemory({
      viewer: actor?.id || null,
      owner: m.owner_id,
      visibility: m.visibility,
      attended,
      manager: isManager,
      completed: event.status === "completed",
      hidden:
        m.status === "hidden" ||
        (m.status === "pending" && actor?.id !== m.owner_id && !isManager),
      blocked,
    })
  )
    throw new AppError("NOT_FOUND", 404);
  return m;
}
export async function command(actor: Actor, action: string, data: unknown) {
  return appDB<Record<string, unknown>>("rpc/woo_v1_command", {
    method: "POST",
    body: JSON.stringify({ p_actor: actor.id, p_action: action, p_data: data }),
  });
}
export async function jsonInput(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 60000)
    throw new AppError("BODY_TOO_LARGE", 413);
  const body = await request.text();
  if (body.length > 60000) throw new AppError("BODY_TOO_LARGE", 413);
  try {
    const data = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new AppError("INVALID_JSON");
  }
}
