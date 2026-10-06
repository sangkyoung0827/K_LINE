import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEccRoleRow } from "@/lib/eccAccess";
import { isTemporaryEccLookupError } from "@/lib/eccAccessRetry";
import { normalizeEmail } from "@/lib/admin";
import { googleFetch } from "./googleApi";
import { actualResponderUrl } from "./responses";
import { supabaseRequest } from "./store";
import { assertGoogleFormsTestEnvironment, isGoogleFormsAdminProduction } from "./safety";
import type { GoogleFormRegistryRow } from "./types";
import { grantWithServerRevocation } from "./eccFormLeases";

export const eccFormEntryLifetime = 15 * 60;
export const eccFormEntryCookie = "ecc-google-form-outage-entry";
export type EccFormEligibility = "eligible" | "unpaid" | "outage" | "unavailable";
type Permission = { id: string; type: string; role: string; view?: string; emailAddress?: string; expirationTime?: string; deleted?: boolean };
const driveBase = "https://www.googleapis.com/drive/v3/files";

export function assertEccResponderGate() {
  assertGoogleFormsTestEnvironment();
  if (isGoogleFormsAdminProduction()) throw new Error("ECC_FORM_GATE_DISABLED");
  if (process.env.GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED !== "true") throw new Error("ECC_FORM_GATE_DISABLED");
}

export async function lookupEccFormEligibility(email: string): Promise<EccFormEligibility> {
  try {
    // Strict mode uses the existing ECC retry policy without writing membership data.
    const row = await getEccRoleRow(email, true);
    return row?.payment_confirmed === true &&
      (row.is_official_member === true || row.official_member_status === "approved" || row.role === "official_member")
      ? "eligible" : "unpaid";
  } catch (error) {
    return isTemporaryEccLookupError(error) ? "outage" : "unavailable";
  }
}

function entrySignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`ecc-form-entry:${payload}`).digest("base64url");
}

export function issueEccFormEntry(email: string, formId: string, expires: number, secret: string) {
  if (!secret) throw new Error("TEMPORARY_ENTRY_SECRET_REQUIRED");
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), formId, expires })).toString("base64url");
  return `${payload}.${entrySignature(payload, secret)}`;
}

export function readEccFormEntry(token: string | undefined, email: string, formId: string, secret: string, now = Date.now()): number | null {
  if (!token || !secret) return null;
  try {
    const [payload, signed, extra] = token.split(".");
    if (!payload || !signed || extra) return null;
    const expected = Buffer.from(entrySignature(payload, secret));
    const actual = Buffer.from(signed);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.email === normalizeEmail(email) && value.formId === formId && Number.isFinite(value.expires) &&
      value.expires > now && value.expires <= now + eccFormEntryLifetime * 1000 ? value.expires : null;
  } catch { return null; }
}

export async function getEccEntryForm(id: string) {
  assertEccResponderGate();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("FORM_NOT_AVAILABLE");
  const rows = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?id=eq.${encodeURIComponent(id)}&club_key=eq.ecc&select=*&limit=1`);
  const form = rows[0];
  if (!form || form.club_key !== "ecc" || form.status !== "open" ||
      (form.application_deadline && (!Number.isFinite(Date.parse(form.application_deadline)) || Date.parse(form.application_deadline) <= Date.now()))) throw new Error("FORM_NOT_AVAILABLE");
  actualResponderUrl(form.responder_url);
  return form;
}

export async function listPermissions(formId: string) {
  const permissions: Permission[] = [];
  let pageToken = "";
  const seen = new Set<string>();
  do {
    const params = new URLSearchParams({ includePermissionsForView: "published", fields: "nextPageToken,permissions(id,type,role,view,emailAddress,expirationTime,deleted)", pageSize: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await googleFetch<{ permissions?: Permission[]; nextPageToken?: string }>(`${driveBase}/${encodeURIComponent(formId)}/permissions?${params}`);
    permissions.push(...(page.permissions || []));
    pageToken = page.nextPageToken || "";
    if (pageToken && (seen.has(pageToken) || seen.size >= 10)) throw new Error("PERMISSION_PAGE_LIMIT");
    seen.add(pageToken);
  } while (pageToken);
  return permissions.filter(item => !item.deleted);
}

export async function grantEccFormResponder(form: GoogleFormRegistryRow, email: string, expires?: number) {
  assertEccResponderGate();
  if (form.club_key !== "ecc" || form.status !== "open" || (form.application_deadline && (!Number.isFinite(Date.parse(form.application_deadline)) || Date.parse(form.application_deadline) <= Date.now()))) throw new Error("FORM_NOT_AVAILABLE");
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("LOGIN_REQUIRED");
  if (expires !== undefined && (!Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + eccFormEntryLifetime * 1000)) throw new Error("INVALID_TEMPORARY_EXPIRY");
  if (process.env.GOOGLE_FORMS_SERVER_REVOCATION_ENABLED === "true") return grantWithServerRevocation(form, normalized, expires);
  // Never issue an unexpiring permission as a fallback on consumer-account/API errors.
  if (expires !== undefined && process.env.GOOGLE_FORMS_NATIVE_EXPIRY_VERIFIED !== "true") throw new Error("NATIVE_PERMISSION_EXPIRY_NOT_VERIFIED");
  const remote = await googleFetch<{ publishSettings?: { publishState?: { isPublished?: boolean; isAcceptingResponses?: boolean } } }>(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(form.google_form_id)}`);
  if (!remote.publishSettings?.publishState?.isPublished || !remote.publishSettings.publishState.isAcceptingResponses) throw new Error("FORM_NOT_AVAILABLE");
  const permissions = await listPermissions(form.google_form_id);
  // Broad/inherited access could bypass both the dues check and the expiry.
  if (permissions.some(item => item.type !== "user")) throw new Error("FORM_RESPONDER_ACCESS_MUST_BE_RESTRICTED");
  const existing = permissions.find(item => normalizeEmail(item.emailAddress) === normalized);
  const usable = (permission: Permission) => {
    const expiry = permission.expirationTime ? Date.parse(permission.expirationTime) : null;
    return expires === undefined ? expiry === null : expiry !== null && expiry > Date.now() && expiry <= expires;
  };
  if (existing && existing.role !== "reader") {
    if (expires !== undefined) throw new Error("EXISTING_ACCESS_IS_NOT_TEMPORARY");
    return { expires: null };
  }
  if (existing && existing.view !== "published") throw new Error("EXISTING_ACCESS_IS_NOT_RESPONDER_ONLY");
  if (existing && expires !== undefined && !existing.expirationTime) throw new Error("EXISTING_ACCESS_IS_NOT_TEMPORARY");
  if (existing && usable(existing)) return { expires: existing.expirationTime ? Date.parse(existing.expirationTime) : null };
  const base = `${driveBase}/${encodeURIComponent(form.google_form_id)}/permissions`;
  const body = { ...(existing ? {} : { type: "user", role: "reader", view: "published", emailAddress: normalized }),
    ...(expires !== undefined ? { expirationTime: new Date(expires).toISOString() } : {}) };
  const url = existing ? `${base}/${encodeURIComponent(existing.id)}?fields=id,expirationTime&${expires === undefined ? "removeExpiration=true" : ""}` : `${base}?sendNotificationEmail=false&fields=id,expirationTime`;
  const created = await googleFetch<Permission>(url, { method: existing ? "PATCH" : "POST", body: JSON.stringify(body) });
  if (!created.id) throw new Error("RESPONDER_PERMISSION_NOT_CONFIRMED");
  let verified: Permission | undefined;
  try {
    verified = (await listPermissions(form.google_form_id)).find(item => item.id === created.id && item.view === "published" && item.role === "reader" && normalizeEmail(item.emailAddress) === normalized);
    if (!verified || !usable(verified)) throw new Error("RESPONDER_PERMISSION_EXPIRY_NOT_CONFIRMED");
  } catch {
    // Revoke only the recipient reader grant we just wrote, never editors or owners.
    await googleFetch(`${base}/${encodeURIComponent(created.id)}`, { method: "DELETE" });
    throw new Error("RESPONDER_PERMISSION_EXPIRY_NOT_CONFIRMED");
  }
  return { expires: verified.expirationTime ? Date.parse(verified.expirationTime) : null };
}

export function eccFormApplicationUrl(form: GoogleFormRegistryRow) {
  if (isGoogleFormsAdminProduction() || form.club_key !== "ecc" || process.env.GOOGLE_FORMS_ECC_RESPONDER_GATE_ENABLED !== "true") return actualResponderUrl(form.responder_url);
  assertEccResponderGate();
  const origin = process.env.GOOGLE_FORMS_ECC_ENTRY_ORIGIN;
  if (!origin || !/^https?:\/\//.test(origin)) throw new Error("ECC_ENTRY_ORIGIN_REQUIRED");
  return new URL(`/google-forms/ecc/${encodeURIComponent(form.id)}`, origin).href;
}
