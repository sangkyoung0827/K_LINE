import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { assertGoogleFormsTestEnvironment } from "@/lib/googleForms/safety";
import { supabaseRequest } from "@/lib/googleForms/store";
import { closeGoogleFormIfNeeded, syncGoogleFormResponses } from "@/lib/googleForms/googleApi";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.GOOGLE_FORMS_CRON_SECRET || process.env.GOOGLE_FORMS_TEST_CRON_SECRET || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("Authorization") || "");
  if (secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    assertGoogleFormsTestEnvironment();
    const lease = randomUUID();
    const forms = await supabaseRequest<GoogleFormRegistryRow[]>("rpc/google_forms_claim_maintenance", { body: JSON.stringify({ p_lease: lease }) });
    const results = [];
    for (const form of forms) {
      let success = false, code: string | null = null;
      try {
        // Closing overdue forms must not depend on a successful response read.
        const deadlineReason = await closeGoogleFormIfNeeded(form.id);
        const count = await syncGoogleFormResponses(form);
        const reason = await closeGoogleFormIfNeeded(form.id);
        success = true;
        results.push({ id: form.id, count, closedFor: reason || deadlineReason, success });
      } catch (error) {
        code = error instanceof Error && error.message === "GOOGLE_RECONNECT_REQUIRED" ? "GOOGLE_RECONNECT_REQUIRED" : "GOOGLE_MAINTENANCE_FAILED";
        results.push({ id: form.id, success, error: code });
      } finally {
        const finished = await supabaseRequest<boolean>("rpc/google_forms_finish_maintenance", { body: JSON.stringify({ p_form: form.id, p_lease: lease, p_success: success, p_error: code }) });
        if (!finished) throw new Error("MAINTENANCE_LEASE_EXPIRED");
      }
    }
    return NextResponse.json({ results }, { status: results.some(result => !result.success) ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "MAINTENANCE_UNAVAILABLE" }, { status: 503 }); }
}
