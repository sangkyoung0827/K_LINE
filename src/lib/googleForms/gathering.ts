import "server-only";
import { parseEccGatheringDays, eccGatheringDayLabels } from "@/lib/eccGatheringDays";
import { assertGoogleFormsTestEnvironment } from "./safety";
import type { GoogleFormDraft } from "./types";

export async function withCurrentGatheringDays(draft: GoogleFormDraft): Promise<GoogleFormDraft> {
  if (draft.clubKey !== "ecc" || draft.templateId !== "ecc_gathering") return draft;
  assertGoogleFormsTestEnvironment();
  const url = process.env.GOOGLE_FORMS_TEST_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.GOOGLE_FORMS_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("GATHERING_WEEKDAY_SETTINGS_REQUIRED");
  // Fixed read-only query. Native applications and switches are never written.
  const response = await fetch(`${url}/rest/v1/ecc_activity_statuses?activity_id=eq.gathering&select=gathering_open_days&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("GATHERING_WEEKDAY_SETTINGS_UNAVAILABLE");
  const rows = await response.json() as Array<{ gathering_open_days: unknown }>;
  const days = parseEccGatheringDays(rows[0]?.gathering_open_days);
  if (!days?.length) throw new Error("NO_VERIFIED_GATHERING_WEEKDAYS");
  const questions = draft.questions.filter(question => question.id !== "gathering-current-days");
  return { ...draft, questions: [...questions, {
    id: "gathering-current-days", title: "Attendance days (select one or both) / 참여 요일 (복수 선택 가능)",
    type: "checkbox", required: true, options: days.map(day => `${eccGatheringDayLabels[day].en} / ${eccGatheringDayLabels[day].ko}`)
  }] };
}
