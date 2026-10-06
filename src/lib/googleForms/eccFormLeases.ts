import "server-only";
import { googleFetch } from "./googleApi";
import { supabaseRequest } from "./store";
import { assertEccResponderGate, listPermissions, lookupEccFormEligibility } from "./eccResponderEntry";
import type { GoogleFormRegistryRow } from "./types";

type Lease = { google_form_id: string; email: string; permission_id: string | null; expires_at: string; state: "pending" | "active" | "promoted" | "revoked" | "attention"; last_error?: string | null };
const drive = (formId: string) => `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(formId)}/permissions`;
const query = (formId: string, email: string) => `ecc_form_entry_leases?google_form_id=eq.${encodeURIComponent(formId)}&email=eq.${encodeURIComponent(email)}`;

async function save(lease: Lease) {
  await supabaseRequest("ecc_form_entry_leases?on_conflict=google_form_id,email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ ...lease, updated_at: new Date().toISOString() }) });
}

async function locked<T>(formId: string, action: () => Promise<T>): Promise<T> {
  const token = await supabaseRequest<string | null>("rpc/ecc_form_lock", { body: JSON.stringify({ p_form_id: formId }) });
  if (!token) throw new Error("FORM_PERMISSION_OPERATION_BUSY");
  try { return await action(); }
  finally { await supabaseRequest("rpc/ecc_form_unlock", { body: JSON.stringify({ p_form_id: formId, p_token: token }) }); }
}

async function assertWorkerHealthy() {
  const [health] = await supabaseRequest<{ checked_at: string }[]>("ecc_form_revoker_health?id=eq.worker&select=checked_at&limit=1");
  const age = Date.now() - Date.parse(health?.checked_at || "");
  if (!Number.isFinite(age) || age < -30_000 || age > 120_000) throw new Error("TEMPORARY_REVOKER_NOT_HEALTHY");
}

export async function grantWithServerRevocation(form: GoogleFormRegistryRow, email: string, expires?: number) {
  assertEccResponderGate();
  if (expires !== undefined) await assertWorkerHealthy();
  return locked(form.google_form_id, async () => {
    const remote = await googleFetch<{ publishSettings?: { publishState?: { isPublished?: boolean; isAcceptingResponses?: boolean } } }>(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(form.google_form_id)}`);
    if (!remote.publishSettings?.publishState?.isPublished || !remote.publishSettings.publishState.isAcceptingResponses) throw new Error("FORM_NOT_AVAILABLE");
    const permissions = await listPermissions(form.google_form_id);
    if (permissions.some(permission => permission.type !== "user")) throw new Error("FORM_RESPONDER_ACCESS_MUST_BE_RESTRICTED");
    const existing = permissions.find(permission => permission.emailAddress?.toLowerCase() === email);
    const [lease] = await supabaseRequest<Lease[]>(`${query(form.google_form_id, email)}&select=*&limit=1`);
    if (existing && (existing.role !== "reader" || existing.view !== "published")) {
      if (expires !== undefined) throw new Error("EXISTING_ACCESS_IS_NOT_TEMPORARY");
      if (lease) await save({ ...lease, state: "promoted", last_error: null });
      return { expires: null };
    }
    if (existing && expires !== undefined) {
      if (lease?.state !== "active" || lease.permission_id !== existing.id || Date.parse(lease.expires_at) <= Date.now()) throw new Error("EXISTING_ACCESS_IS_NOT_TEMPORARY");
      return { expires: Date.parse(lease.expires_at) };
    }
    if (existing && expires === undefined) {
      if (existing.expirationTime) await googleFetch(`${drive(form.google_form_id)}/${encodeURIComponent(existing.id)}?removeExpiration=true`, { method: "PATCH", body: "{}" });
      if (lease) await save({ ...lease, state: "promoted", last_error: null });
      return { expires: null };
    }
    if (lease && ["pending", "attention"].includes(lease.state)) throw new Error("PREVIOUS_GRANT_NEEDS_RECONCILIATION");
    const next: Lease = { google_form_id: form.google_form_id, email, permission_id: null, expires_at: new Date(expires ?? Date.now()).toISOString(), state: "pending" };
    // Persist before issuing external access so crashes/ambiguous responses stay visible.
    await save(next);
    let permissionId: string | undefined;
    try {
      const created = await googleFetch<{ id?: string }>(`${drive(form.google_form_id)}?sendNotificationEmail=false&fields=id`, { method: "POST", body: JSON.stringify({ type: "user", role: "reader", view: "published", emailAddress: email }) });
      permissionId = created.id;
      if (!permissionId) throw new Error("RESPONDER_PERMISSION_NOT_CONFIRMED");
      next.permission_id = permissionId;
      await save(next);
      const verified = (await listPermissions(form.google_form_id)).find(item => item.id === permissionId && item.emailAddress?.toLowerCase() === email && item.role === "reader" && item.view === "published");
      if (!verified) throw new Error("RESPONDER_PERMISSION_NOT_CONFIRMED");
      await save({ ...next, state: expires === undefined ? "promoted" : "active", last_error: null });
      return { expires: expires ?? null };
    } catch {
      if (permissionId) {
        await googleFetch(`${drive(form.google_form_id)}/${encodeURIComponent(permissionId)}`, { method: "DELETE" });
        await save({ ...next, state: "revoked", last_error: "GRANT_FAILED" });
      } else await save({ ...next, state: "attention", last_error: "AMBIGUOUS_GRANT" });
      throw new Error("RESPONDER_GRANT_FAILED");
    }
  });
}

export async function revokeExpiredEccFormEntries(now = Date.now()) {
  assertEccResponderGate();
  if (process.env.GOOGLE_FORMS_SERVER_REVOCATION_ENABLED !== "true") throw new Error("SERVER_REVOCATION_DISABLED");
  const due = await supabaseRequest<Lease[]>(`ecc_form_entry_leases?state=in.(active,pending)&expires_at=lte.${encodeURIComponent(new Date(now).toISOString())}&order=expires_at.asc&limit=10`);
  const result = { revoked: 0, promoted: 0, retry: 0, attention: 0 };
  for (const old of due) {
    try {
      await locked(old.google_form_id, async () => {
        const [lease] = await supabaseRequest<Lease[]>(`${query(old.google_form_id, old.email)}&select=*&limit=1`);
        if (!lease || !["active", "pending"].includes(lease.state) || Date.parse(lease.expires_at) > now) return;
        if (!lease.permission_id) { await save({ ...lease, state: "attention", last_error: "PERMISSION_ID_MISSING" }); result.attention++; return; }
        // Never revoke an unrelated permission, owner/editor or subsequently promoted grant.
        const permission = (await listPermissions(old.google_form_id)).find(item => item.id === lease.permission_id);
        if (permission && (permission.role !== "reader" || permission.view !== "published" || permission.emailAddress?.toLowerCase() !== lease.email)) {
          await save({ ...lease, state: "attention", last_error: "PERMISSION_CHANGED" }); result.attention++; return;
        }
        if (permission && await lookupEccFormEligibility(lease.email) === "eligible") {
          await save({ ...lease, state: "promoted", last_error: null }); result.promoted++; return;
        }
        if (permission) await googleFetch(`${drive(old.google_form_id)}/${encodeURIComponent(lease.permission_id)}`, { method: "DELETE" });
        if ((await listPermissions(old.google_form_id)).some(item => item.id === lease.permission_id)) throw new Error("REVOCATION_NOT_CONFIRMED");
        await save({ ...lease, state: "revoked", last_error: null }); result.revoked++;
      });
    } catch { result.retry++; }
  }
  const unresolved = await supabaseRequest<Lease[]>("ecc_form_entry_leases?state=eq.attention&select=google_form_id&limit=1");
  result.attention = Math.max(result.attention, unresolved.length);
  if (!result.retry && !result.attention && !unresolved.length) {
    await supabaseRequest("ecc_form_revoker_health?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "worker", checked_at: new Date().toISOString() }) });
  }
  return result;
}
