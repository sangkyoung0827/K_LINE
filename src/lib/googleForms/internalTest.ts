import type { GoogleFormRegistryRow } from "./types";

type Grant = { registryId: string; googleFormId: string; issuedAt: string; expiresAt: string };
export function internalTestControls(row: GoogleFormRegistryRow, configuration: string, now = Date.now()) {
  const denied = { canOpen: false, canClose: false };
  if (row.club_key !== "ecc" || row.status === "archived" || !/test|테스트|검증/i.test(row.title)) return denied;
  let grants: Grant[];
  try { grants = JSON.parse(configuration); } catch { return denied; }
  if (!Array.isArray(grants) || grants.length < 1 || grants.length > 2) return denied;
  const grant = grants.find(g => g && g.registryId === row.id && g.googleFormId === row.google_form_id);
  if (!grant || typeof grant.issuedAt !== "string" || typeof grant.expiresAt !== "string") return denied;
  const issued = Date.parse(grant.issuedAt), expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= issued || expires - issued > 86400000) return denied;
  // An expired grant may only reduce access to its already-open test form.
  return { canOpen: now < expires, canClose: row.status === "open" };
}
