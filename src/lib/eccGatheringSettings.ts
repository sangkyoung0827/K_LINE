import "server-only";
import { parseEccGatheringDays, type EccGatheringDay } from "@/lib/eccGatheringDays";
import { supabaseRequest, SupabaseRequestError } from "@/lib/supabaseServer";

export function isMissingGatheringColumn(error: unknown, column: string) {
  return error instanceof SupabaseRequestError && error.status === 400 &&
    error.message.includes(column) && /column|schema cache/i.test(error.message);
}

export async function getEccGatheringSettings() {
  try {
    const rows = await supabaseRequest<Array<{ gathering_open_days: unknown }>>(
      "ecc_activity_statuses?activity_id=eq.gathering&select=gathering_open_days",
      { cache: "no-store" }
    );
    const days = parseEccGatheringDays(rows[0]?.gathering_open_days);
    return { gatheringOpenDays: days ?? [], gatheringDaysReady: days !== null };
  } catch (error) {
    if (!isMissingGatheringColumn(error, "gathering_open_days")) throw error;
    return { gatheringOpenDays: [], gatheringDaysReady: false };
  }
}

export async function updateEccGatheringSettings(days: EccGatheringDay[], email: string) {
  // A day-only edit must not reopen the activity or replace its current instance.
  const rows = await supabaseRequest<Array<{ activity_id: string }>>(
    "ecc_activity_statuses?activity_id=eq.gathering&select=activity_id",
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({
      gathering_open_days: days, updated_by: email, updated_at: new Date().toISOString()
    }) }
  );
  if (rows.length !== 1) throw new Error("ECC Gathering settings are not initialized.");
  return getEccGatheringSettings();
}
