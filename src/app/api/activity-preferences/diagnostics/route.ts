import { auth } from "@/auth";
import { getAdminAccess } from "@/lib/admin";
import { ACTIVITY_PREFERENCE_MODEL_VERSION } from "@/lib/activity-preferences/config";
import { preferenceStore, logPreferenceFailure } from "@/lib/activity-preferences/store";

export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  const access = await getAdminAccess(session?.user?.email ?? "");
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!session?.user?.email || !access.isSuperAdmin) return Response.json({ error: "Privileged access required." }, { status: session?.user?.email ? 403 : 401, headers });
  try {
    return Response.json({ modelVersion: ACTIVITY_PREFERENCE_MODEL_VERSION, diagnostics: await preferenceStore("rpc/activity_preference_diagnostics") }, { headers });
  } catch {
    logPreferenceFailure("diagnostics");
    return Response.json({ ready: false }, { status: 503, headers });
  }
}
