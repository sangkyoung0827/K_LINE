import "server-only";
import { supabaseRequest } from "@/lib/supabaseServer";
import { preferenceConfig } from "./config";

export type PreferenceStore = <T>(path: string, init?: RequestInit) => Promise<T>;
export const preferenceStore: PreferenceStore = (path, init = {}) => supabaseRequest(path, {
  ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(preferenceConfig.requestTimeoutMs)
});

export async function* preferencePages<T>(path: string, store: PreferenceStore = preferenceStore): AsyncGenerator<T[]> {
  // Offset pagination uses the number actually returned, not an assumed REST cap.
  let offset = 0;
  for (;;) {
    const rows = await store<T[]>(`${path}&order=id.asc&limit=${preferenceConfig.pageSize}&offset=${offset}`);
    if (!rows.length) return;
    yield rows;
    offset += rows.length;
  }
}

export function logPreferenceFailure(operation: string) {
  // Never log request payloads, email keys, DB errors or personal behavior.
  console.warn("Activity preferences secondary operation failed", { operation, repair: "reconciliation" });
}
