import "server-only";
import { supabaseRequest } from "@/lib/supabaseServer";
import { normalizeHistoryUserId } from "@/lib/woohyukmonHistory";
import { buildPersonalMemory, personalMemoryQuery, type MemoryRow } from "./memory";

export async function loadPersonalMemory(email: string | null | undefined, message: string, enabled = true) {
  const owner = normalizeHistoryUserId(email);
  const empty = buildPersonalMemory([], owner, message);
  if (!owner || !enabled) return empty;
  try {
    const signal = AbortSignal.timeout(4000);
    const [rows, preferences] = await Promise.all([false, true].map((preferencesOnly) =>
      supabaseRequest<MemoryRow[]>(personalMemoryQuery(owner, preferencesOnly), { cache: "no-store", signal })
    ));
    return buildPersonalMemory([...rows, ...preferences], owner, message);
  } catch {
    // History outages must not interrupt chat or expose private query contents.
    console.warn("WooHyukmon personal history temporarily unavailable");
    return empty;
  }
}
