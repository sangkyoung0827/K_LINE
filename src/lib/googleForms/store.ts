import "server-only";
import { assertGoogleFormsTestEnvironment } from "./safety";

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertGoogleFormsTestEnvironment();
  const url = process.env.GOOGLE_FORMS_TEST_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url === process.env.SUPABASE_URL?.replace(/\/+$/, "") ||
      new URL(url).hostname === "okcabiimxuhhhokqajjg.supabase.co") throw new Error("ISOLATED_GOOGLE_FORMS_TEST_DATABASE_REQUIRED");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const result = await fetch(`${url}/rest/v1/${path}`, {
    ...init, signal: AbortSignal.timeout(20_000), cache: "no-store",
    headers
  });
  if (!result.ok) throw new Error(`GOOGLE_FORMS_STORE_ERROR_${result.status}`);
  const body = await result.text();
  return (body ? JSON.parse(body) : null) as T;
}
