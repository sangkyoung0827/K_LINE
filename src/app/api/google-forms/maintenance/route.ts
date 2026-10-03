import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { assertGoogleFormsTestEnvironment } from "@/lib/googleForms/safety";
import { supabaseRequest } from "@/lib/googleForms/store";
import { registryColumns, setGoogleFormStatus, syncGoogleFormResponses } from "@/lib/googleForms/googleApi";
import type { GoogleFormRegistryRow } from "@/lib/googleForms/types";

export const dynamic = "force-dynamic";

// No cron schedule is installed. Enable only in the isolated test environment.
export async function GET(request: Request) {
  const secret = process.env.GOOGLE_FORMS_TEST_CRON_SECRET || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("Authorization") || "");
  if (secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    assertGoogleFormsTestEnvironment();
    const forms = await supabaseRequest<GoogleFormRegistryRow[]>(`google_forms?select=${registryColumns}&status=in.(open,closed)&order=last_response_sync_at.asc.nullsfirst&limit=20`, { cache: "no-store" });
    const results = [];
    for (const form of forms) {
      try {
        if (form.status === "open" && form.application_deadline && Date.parse(form.application_deadline) <= Date.now()) await setGoogleFormStatus(form, "closed");
        results.push({ id: form.id, count: await syncGoogleFormResponses(form), success: true });
      } catch { results.push({ id: form.id, success: false }); }
    }
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "TEST_MAINTENANCE_UNAVAILABLE" }, { status: 503 }); }
}
