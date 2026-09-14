import { reconcileActivityPreferences } from "../src/lib/activity-preferences/reconcile";
import type { PreferenceStore } from "../src/lib/activity-preferences/store";

export async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set server-side SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this process.");
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--gates-passed")) throw new Error("Apply requires --gates-passed after tests, typecheck, build and migration verification.");
  const store: PreferenceStore = async <T>(path: string, init: RequestInit = {}) => {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...init, cache: "no-store", signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(init.headers)), apikey: key, Authorization: `Bearer ${key}` }
    });
    if (!response.ok) throw new Error(`Preference maintenance request failed (${response.status}).`);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  };
  // A fresh read-only preflight re-counts sources immediately before any writes.
  const before = await reconcileActivityPreferences({ store });
  console.log(JSON.stringify({ preflight: before }));
  if (before.errors) throw new Error("Preflight failed; no backfill started.");
  if (!apply) return;
  const result = await reconcileActivityPreferences({ apply: true, store });
  console.log(JSON.stringify({ backfill: result, verification: await store("rpc/activity_preference_diagnostics") }));
  if (result.errors) process.exitCode = 1;
}
