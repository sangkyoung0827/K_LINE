import {
  appDB,
  command,
  getActor,
  getEvent,
  jsonInput,
  manager,
  requireAppEnabled,
  requireWrite,
  accessibleMemory,
  digest,
} from "@/lib/woohyukmonApp/server";
import type { EventRow, MemoryRow } from "@/lib/woohyukmonApp/server";
import {
  AppError,
  parseEvent,
  parseAnswers,
  publicEvent,
  uuid,
} from "@/lib/woohyukmonApp/model";
import { errorResponse, respond } from "@/lib/woohyukmonApp/http";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ segments: string[] }> };
const text = (v: unknown, max: number, required = false) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new AppError("INVALID_TEXT");
  return v.trim();
};
export async function OPTIONS(request: Request) {
  return respond(request, {});
}
export async function GET(request: Request, ctx: Context) {
  try {
    requireAppEnabled();
    const { segments: s } = await ctx.params;
    const actor = await getActor(request, false);
    if (s.length === 1 && s[0] === "me")
      return respond(request, {
        user: actor
          ? { id: actor.id, name: actor.name, readOnly: actor.readOnly }
          : null,
      });
    if (s.length === 1 && s[0] === "organizations") {
      if (!actor) throw new AppError("LOGIN_REQUIRED", 401);
      const rows = await appDB<Record<string, unknown>[]>(
        `woo_v1_organization_members?member_id=eq.${actor.id}&select=role,organization:woo_v1_organizations(id,name)&limit=100`,
      );
      return respond(request, { organizations: rows });
    }
    if (s.length === 1 && s[0] === "events") {
      const query = new URLSearchParams({
        select: "*",
        status: "neq.draft",
        visibility: "eq.public",
        order: "starts_at.desc,id.desc",
        limit: "50",
      });
      if (new URL(request.url).searchParams.get("managed") === "true") {
        if (!actor) throw new AppError("LOGIN_REQUIRED", 401);
        const memberships = await appDB<{ organization_id: string }[]>(
          `woo_v1_organization_members?member_id=eq.${actor.id}&role=in.(owner,admin)&select=organization_id&limit=100`,
        );
        const roles = await appDB<{ event_id: string }[]>(
          `woo_v1_event_admin_roles?member_id=eq.${actor.id}&role=eq.manager&select=event_id&limit=100`,
        );
        if (!memberships.length && !roles.length)
          return respond(request, { events: [] });
        query.delete("status");
        query.delete("visibility");
        const predicates = [];
        if (memberships.length)
          predicates.push(
            `organization_id.in.(${memberships.map((r) => uuid(r.organization_id)).join(",")})`,
          );
        if (roles.length)
          predicates.push(
            `id.in.(${roles.map((r) => uuid(r.event_id)).join(",")})`,
          );
        query.set("or", `(${predicates.join(",")})`);
      }
      const rows = await appDB<EventRow[]>(`woo_v1_events?${query}`);
      return respond(request, { events: rows.map(publicEvent) });
    }
    if (s[0] === "events" && s.length >= 2) {
      const event = await getEvent(s[1], actor),
        canManage = actor ? await manager(actor, event.id) : false;
      if (s.length === 2) {
        const applications = actor
          ? await appDB<Record<string, unknown>[]>(
              `woo_v1_applications?event_id=eq.${event.id}&member_id=eq.${actor.id}&select=id,status,answers&limit=1`,
            )
          : [];
        const announcements = await appDB<Record<string, unknown>[]>(
          `woo_v1_announcements?event_id=eq.${event.id}&status=eq.published&select=id,body_ko,body_en,application_url,created_at&order=created_at.desc&limit=30`,
        );
        return respond(request, {
          event: publicEvent(event),
          canManage,
          myApplication: applications[0] || null,
          announcements,
        });
      }
      if (s.length === 3 && s[2] === "applications") {
        if (!actor || !canManage) throw new AppError("FORBIDDEN", 403);
        const rows = await appDB<Record<string, unknown>[]>(
          `woo_v1_applications?event_id=eq.${event.id}&select=id,member_id,display_name,status,created_at&order=created_at.asc&limit=1000`,
        );
        const attendance = await appDB<{ member_id: string }[]>(
          `woo_v1_attendance?event_id=eq.${event.id}&select=member_id&limit=10000`,
        );
        return respond(request, {
          applications: rows.map((r) => ({
            ...r,
            attended: attendance.some((a) => a.member_id === r.member_id),
          })),
        });
      }
      if (s.length === 3 && s[2] === "memories") {
        const rows = await appDB<MemoryRow[]>(
          `woo_v1_memories?event_id=eq.${event.id}&order=created_at.desc&limit=50`,
        );
        const visible: MemoryRow[] = [];
        for (const row of rows) {
          try {
            await accessibleMemory(row.id, actor);
            visible.push(row);
          } catch (error) {
            if (!(error instanceof AppError && error.status === 404))
              throw error;
          }
        }
        return respond(request, { memories: visible });
      }
    }
    if (s.length === 1 && s[0] === "memories") {
      if (!actor) throw new AppError("LOGIN_REQUIRED", 401);
      const attendance = await appDB<{ event_id: string }[]>(
        `woo_v1_attendance?member_id=eq.${actor.id}&select=event_id&limit=1000`,
      );
      if (!attendance.length)
        return respond(request, { events: [], memories: [] });
      const events = await appDB<EventRow[]>(
        `woo_v1_events?id=in.(${attendance.map((a) => uuid(a.event_id)).join(",")})&status=eq.completed&memories_enabled=eq.true&order=ends_at.desc&limit=100`,
      );
      const memories = await appDB<MemoryRow[]>(
        `woo_v1_memories?owner_id=eq.${actor.id}&status=neq.hidden&order=created_at.desc&limit=100`,
      );
      return respond(request, { events: events.map(publicEvent), memories });
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (error) {
    return errorResponse(request, error);
  }
}
export async function POST(request: Request, ctx: Context) {
  try {
    const actor = (await getActor(request))!;
    const { segments: s } = await ctx.params,
      data = await jsonInput(request);
    // Read-only collaborators may still revoke their own session or request deletion.
    requireWrite(actor, request, s.length === 1 && ["logout", "deletion-request"].includes(s[0]));
    if (s.length === 1 && s[0] === "logout") {
      const header = request.headers.get("authorization");
      if (header)
        await appDB(
          `woo_v1_mobile_sessions?token_hash=eq.${digest(header.slice(7))}`,
          {
            method: "PATCH",
            body: JSON.stringify({ revoked_at: new Date().toISOString() }),
          },
        );
      return respond(request, { loggedOut: true });
    }
    if (s.length === 1 && s[0] === "organizations")
      return respond(
        request,
        await command(actor, "create_organization", {
          name: text(data.name, 120, true),
        }),
        201,
      );
    if (s.length === 1 && s[0] === "events")
      return respond(
        request,
        await command(actor, "create_event", {
          ...parseEvent(data),
          organizationId: uuid(data.organizationId),
        }),
        201,
      );
    if (s.length === 1 && s[0] === "deletion-request")
      return respond(
        request,
        await command(actor, "request_deletion", {}),
        202,
      );
    if (s.length === 1 && s[0] === "blocks")
      return respond(
        request,
        await command(actor, "block_user", { memberId: uuid(data.memberId) }),
      );
    if (s[0] === "events" && s.length === 3) {
      const event = await getEvent(s[1], actor),
        eventId = event.id;
      let action: string,
        payload: Record<string, unknown> = { ...data, eventId };
      switch (s[2]) {
        case "update":
          action = "update_event";
          if (!Number.isInteger(data.revision))
            throw new AppError("INVALID_REVISION");
          payload = { ...parseEvent(data), eventId, revision: data.revision };
          break;
        case "status":
          action = "set_status";
          payload = { eventId, status: text(data.status, 20, true) };
          break;
        case "apply":
          action = "apply";
          payload = {
            eventId,
            displayName: text(data.displayName || actor.name, 120, true),
            answers: parseAnswers(data.answers, event.questions),
          };
          break;
        case "cancel":
          action = "cancel_application";
          payload = { eventId };
          break;
        case "review":
          action = "review_application";
          payload = {
            eventId,
            applicationId: uuid(data.applicationId),
            status: text(data.status, 20, true),
          };
          break;
        case "attendance":
          action = "confirm_attendance";
          payload = { eventId, memberId: uuid(data.memberId) };
          break;
        case "roles":
          action = "set_event_role";
          payload = {
            eventId,
            memberId: uuid(data.memberId),
            role: text(data.role, 20, true),
          };
          break;
        case "memories":
          action = "save_memory";
          payload = {
            eventId,
            ...(data.memoryId ? { memoryId: uuid(data.memoryId) } : {}),
            title: text(data.title, 180, true),
            body: text(data.body, 12000),
            visibility: text(data.visibility, 20, true),
            photoConsent: data.photoConsent === true,
          };
          break;
        case "reports":
          action = "report_memory";
          payload = {
            eventId,
            memoryId: uuid(data.memoryId),
            reason: text(data.reason, 2000, true),
          };
          break;
        case "moderate":
          action = "moderate_memory";
          payload = {
            eventId,
            memoryId: uuid(data.memoryId),
            status: text(data.status, 20, true),
          };
          break;
        case "announcements":
          action = "save_announcement";
          payload = {
            eventId,
            bodyKo: text(data.bodyKo, 20000),
            bodyEn: text(data.bodyEn, 20000),
            applicationUrl: text(data.applicationUrl || "", 2048),
            status: text(data.status, 20, true),
          };
          if (
            payload.applicationUrl &&
            !/^https:\/\//.test(String(payload.applicationUrl))
          )
            throw new AppError("INVALID_URL");
          break;
        default:
          throw new AppError("NOT_FOUND", 404);
      }
      return respond(request, await command(actor, action, payload));
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (error) {
    return errorResponse(request, error);
  }
}
