import "server-only";
import { assertGoogleFormsTestEnvironment } from "./safety";

const testTables = new Set([
  "google_oauth_connections", "google_forms", "google_form_responses",
  "google_form_creation_attempts", "google_form_workflows", "google_form_operation_audit",
  "club_board_posts", "site_members", "ecc_form_entry_leases", "ecc_form_revoker_health"
]);

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertGoogleFormsTestEnvironment();
  const url = process.env.GOOGLE_FORMS_TEST_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY;
  const prefix = process.env.GOOGLE_FORMS_TEST_TABLE_PREFIX || "";
  if (prefix && prefix !== "kline_forms_test_") throw new Error("INVALID_GOOGLE_FORMS_TEST_TABLE_PREFIX");
  if (!url || !key || (!prefix && (url === process.env.SUPABASE_URL?.replace(/\/+$/, "") ||
      new URL(url).hostname === "okcabiimxuhhhokqajjg.supabase.co"))) throw new Error("ISOLATED_GOOGLE_FORMS_TEST_DATABASE_REQUIRED");
  const match = /^([a-z_]+)(\?[^#]*)?$/.exec(path);
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const rpc = /^rpc\/(ecc_form_lock|ecc_form_unlock)$/.exec(path);
  if (rpc) {
    const result = await fetch(`${url}/rest/v1/rpc/${prefix}${rpc[1]}`, { ...init, method: "POST", signal: AbortSignal.timeout(20_000), cache: "no-store", headers });
    if (!result.ok) throw new Error(`GOOGLE_FORMS_STORE_ERROR_${result.status}`);
    return await result.json() as T;
  }
  if (!match || !testTables.has(match[1])) throw new Error("GOOGLE_FORMS_TEST_TABLE_NOT_ALLOWED");
  const target = `${prefix}${match[1]}${match[2] || ""}`;
  const result = await fetch(`${url}/rest/v1/${target}`, {
    ...init, signal: AbortSignal.timeout(20_000), cache: "no-store",
    headers
  });
  if (!result.ok) throw new Error(`GOOGLE_FORMS_STORE_ERROR_${result.status}`);
  const body = await result.text();
  return (body ? JSON.parse(body) : null) as T;
}
