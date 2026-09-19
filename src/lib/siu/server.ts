import "server-only";
import { NextResponse } from "next/server";
import { getAdminAccess, normalizeEmail } from "@/lib/admin";
import { supabaseRequest, SupabaseRequestError } from "@/lib/supabaseServer";
import { getCurrentSiuAccess, requireSiuWrite } from "./access";
import { scheduleSiuPreference, retrySiuPreferences } from "./preferences";
import { SiuError, siuId, validateActivity, type SiuAccess, type SiuApplication, type SiuPrivateActivity, type SiuActivity } from "./model";

const db = <T>(path: string, init: RequestInit = {}) => supabaseRequest<T>(path, { ...init, cache: "no-store", signal: AbortSignal.timeout(12000) });
const columns = "id,creator_user_key,creator_display_name,title,short_description,description,categories,tags,cover_image_url,starts_at,ends_at,location_name,location_address,capacity,application_deadline,is_free,fee_krw,preparation_notes,contact_note,open_chat_url,status,created_at,updated_at,application_count";
export function publicActivity(row: SiuPrivateActivity): SiuActivity {
  // Explicit projection prevents future private/audit columns leaking on public endpoints.
  return {
    id: row.id, creator_display_name: row.creator_display_name, title: row.title, short_description: row.short_description,
    description: row.description, categories: row.categories, tags: row.tags, cover_image_url: row.cover_image_url,
    starts_at: row.starts_at, ends_at: row.ends_at, location_name: row.location_name, location_address: row.location_address,
    capacity: row.capacity, application_deadline: row.application_deadline, is_free: row.is_free, fee_krw: row.fee_krw,
    preparation_notes: row.preparation_notes, contact_note: row.contact_note, open_chat_url: row.open_chat_url,
    status: row.status, created_at: row.created_at, updated_at: row.updated_at, application_count: row.application_count
  };
}
export async function siuActivity(id: string) {
  const rows = await db<SiuPrivateActivity[]>(`siu_activity_summaries?select=${columns}&id=eq.${siuId(id)}&limit=1`);
  if (!rows[0]) throw new SiuError("NOT_FOUND", 404);
  return rows[0];
}
function manages(a: SiuPrivateActivity, access: SiuAccess) {
  return access.authenticated && (access.isAdmin || a.creator_user_key === access.email);
}
function pageOffset(params: URLSearchParams) {
  const raw = params.get("offset") || "0";
  if (!/^\d{1,7}$/.test(raw)) throw new SiuError("INVALID_PAGE");
  return Number(raw);
}
export async function listSiuActivities(params: URLSearchParams, access?: SiuAccess) {
  const offset = pageOffset(params);
  const mode = params.get("mode");
  const limit = mode === "current" ? 6 : 20;
  const query = new URLSearchParams({ select: columns, order: "starts_at.asc,id.asc", limit: String(limit + 1), offset: String(offset) });
  if (mode === "admin" || mode === "created") {
    if (!access?.authenticated) throw new SiuError("LOGIN_REQUIRED", 401);
    if (mode === "admin" && !access.isAdmin) throw new SiuError("FORBIDDEN", 403);
    if (mode === "created") query.set("creator_user_key", `eq.${access.email}`);
    query.set("order", "created_at.desc,id.desc");
  } else {
    query.set("status", "eq.published");
    query.set("starts_at", `gt.${new Date().toISOString()}`);
    query.set("or", `(application_deadline.is.null,application_deadline.gt.${new Date().toISOString()})`);
  }
  const rows = await db<SiuPrivateActivity[]>(`siu_activity_summaries?${query}`);
  return { activities: rows.slice(0, limit).map(publicActivity), nextOffset: rows.length > limit ? offset + limit : null };
}
export async function siuDetail(id: string, access: SiuAccess) {
  const a = await siuActivity(id);
  if (["hidden", "draft"].includes(a.status) && !manages(a, access)) throw new SiuError("NOT_FOUND", 404);
  const rows = access.authenticated ? await db<SiuApplication[]>(`siu_activity_applications?select=id,status,rating,rated_at&activity_id=eq.${a.id}&user_key=eq.${encodeURIComponent(access.email)}&limit=1`) : [];
  return { activity: publicActivity(a), access, canManage: manages(a, access),
    canEdit: a.creator_user_key === access.email && !["hidden", "cancelled"].includes(a.status), application: rows[0] || null };
}
export async function siuMy(access: SiuAccess, params: URLSearchParams) {
  if (!access.authenticated) throw new SiuError("LOGIN_REQUIRED", 401);
  if (params.get("tab") === "created") return listSiuActivities(new URLSearchParams({ mode: "created", offset: String(pageOffset(params)) }), access);
  const offset = pageOffset(params);
  const apps = await db<SiuApplication[]>(`siu_activity_applications?select=id,activity_id,status,rating,rated_at&user_key=eq.${encodeURIComponent(access.email)}&order=applied_at.desc,id.desc&limit=21&offset=${offset}`);
  const activities = apps.length ? await db<SiuPrivateActivity[]>(`siu_activity_summaries?select=${columns}&id=in.(${apps.map((p) => p.activity_id).join(",")})`) : [];
  return { items: apps.slice(0, 20).map((p) => {
    const activity = activities.find((a) => a.id === p.activity_id)!;
    // A previously applied user retains their own receipt, but not hidden content.
    const visible = !["draft", "hidden"].includes(activity.status) || manages(activity, access);
    return { application: p, activity: visible ? publicActivity(activity) : {
      id: activity.id, title: "Unavailable activity", status: activity.status, starts_at: activity.starts_at
    } };
  }), nextOffset: apps.length > 20 ? offset + 20 : null };
}
export async function siuApplicants(id: string, access: SiuAccess, params: URLSearchParams) {
  const a = await siuActivity(id);
  if (!manages(a, access)) throw new SiuError("FORBIDDEN", 403);
  const offset = pageOffset(params);
  const rows = await db<SiuApplication[]>(`siu_activity_applications?select=id,display_name,status,applied_at&activity_id=eq.${a.id}&order=applied_at.asc,id.asc&limit=51&offset=${offset}`);
  return { applicants: rows.slice(0, 50), nextOffset: rows.length > 50 ? offset + 50 : null };
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new SiuError("INVALID_INPUT");
  const raw = await request.text();
  if (raw.length > 30000) throw new SiuError("INPUT_TOO_LARGE", 413);
  try { const parsed = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw Error(); return parsed as Record<string, unknown>; }
  catch { throw new SiuError("INVALID_INPUT"); }
}
export async function mutateActivity(request: Request, access: SiuAccess, id: string | null) {
  requireSiuWrite(access);
  const input = await body(request);
  const action = String(input.action || "save");
  if (!["save", "close", "cancel", "hide", "unhide"].includes(action)) throw new SiuError("INVALID_ACTION");
  if (id) siuId(id);
  const data = action === "save" ? validateActivity(input.activity) : null;
  if (data?.status === "published" && Date.parse(data.starts_at) <= Date.now()) throw new SiuError("START_MUST_BE_FUTURE");
  if (id && (typeof input.updated_at !== "string" || !Number.isFinite(Date.parse(input.updated_at)))) throw new SiuError("STALE_ACTIVITY", 409);
  const saved = await db<SiuPrivateActivity>("rpc/siu_save_activity", { method: "POST", body: JSON.stringify({
    p_actor: access.email, p_name: access.displayName, p_admin: access.isAdmin, p_id: id,
    p_action: action, p_expected_updated_at: input.updated_at || null, p_data: data
  }) });
  return { id: saved.id };
}
export async function mutateApplication(request: Request, access: SiuAccess, id: string) {
  requireSiuWrite(access);
  const input = await body(request);
  if (!["apply", "cancel", "rate"].includes(String(input.action))) throw new SiuError("INVALID_ACTION");
  if (input.action === "rate" && (typeof input.rating !== "number" || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) throw new SiuError("INVALID_RATING");
  const saved = await db<SiuApplication>("rpc/siu_apply", { method: "POST", body: JSON.stringify({
    p_activity_id: siuId(id), p_user: access.email, p_name: access.displayName, p_action: input.action, p_rating: input.rating ?? null
  }) });
  if (input.action !== "cancel") scheduleSiuPreference(saved);
  return { ok: true };
}
export async function siuRoleList(access: SiuAccess, params: URLSearchParams) {
  if (!access.isAdmin) throw new SiuError("FORBIDDEN", 403);
  const query = new URLSearchParams({ select: "email,role,updated_at", order: "email.asc", limit: "51", offset: String(pageOffset(params)) });
  const search = params.get("search")?.trim() || "";
  if (search.length > 120 || /[^a-zA-Z0-9@._+\-]/.test(search)) throw new SiuError("INVALID_SEARCH");
  if (search) query.set("email", `ilike.*${search}*`);
  const roles = await db<unknown[]>(`siu_roles?${query}`);
  return { roles: roles.slice(0, 50), nextOffset: roles.length > 50 ? pageOffset(params) + 50 : null };
}
export async function mutateRole(request: Request, access: SiuAccess) {
  requireSiuWrite(access);
  if (!access.isAdmin) throw new SiuError("FORBIDDEN", 403);
  const input = await body(request);
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  if (typeof input.role !== "string" || !["user", "official_member", "admin", "super_admin"].includes(input.role)) throw new SiuError("INVALID_ROLE");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SiuError("INVALID_EMAIL");
  const target = await getAdminAccess(email);
  if (target.isSuperAdmin) throw new SiuError("FORBIDDEN", 403);
  await db("rpc/siu_set_role", { method: "POST", body: JSON.stringify({
    p_actor: access.email, p_global_rank: access.globalRank, p_email: email, p_role: input.role
  }) });
  return { ok: true };
}
const knownCodes = ["LOGIN_REQUIRED","FORBIDDEN","NOT_FOUND","STALE_ACTIVITY","ACTIVITY_LOCKED","INVALID_ACTION","INVALID_ACTIVITY_STATE",
  "RATED_DATE_LOCKED","NOT_APPLIED","CANCELLATION_CLOSED","RATING_NOT_ELIGIBLE","ALREADY_RATED","INVALID_RATING","APPLICATION_CLOSED",
  "ALREADY_APPLIED","CAPACITY_REACHED","CREATE_LIMIT"];
export async function siuEndpoint(request: Request, task: (access: SiuAccess, params: URLSearchParams) => Promise<unknown>, publicList = false) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (!origin || origin !== new URL(request.url).origin) throw new SiuError("INVALID_ORIGIN", 403);
    }
    const access = publicList ? undefined : await getCurrentSiuAccess();
    const result = await task(access!, new URL(request.url).searchParams);
    return NextResponse.json(publicList ? result : { ...(result as object), ownerEmail: access!.email }, { headers });
  } catch (error) {
    let code = error instanceof SiuError ? error.code : "SERVICE_UNAVAILABLE";
    let status = error instanceof SiuError ? error.status : 503;
    if (error instanceof SupabaseRequestError) {
      const found = knownCodes.find((value) => error.message.includes(`"${value}"`));
      if (found) { code = found; status = found === "FORBIDDEN" ? 403 : found === "NOT_FOUND" ? 404 : 409; }
    }
    return NextResponse.json({ error: code }, { status, headers });
  }
}
export async function retrySiu(access: SiuAccess) {
  requireSiuWrite(access);
  if (!access.isAdmin) throw new SiuError("FORBIDDEN", 403);
  return retrySiuPreferences();
}
