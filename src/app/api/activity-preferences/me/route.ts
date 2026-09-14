import { auth } from "@/auth";
import { normalizePreferenceUserKey } from "@/lib/activity-preferences/identity";
import { getUserActivityPreferenceProfile } from "@/lib/activity-preferences/server";
import { logPreferenceFailure } from "@/lib/activity-preferences/store";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET() {
  const session = await auth();
  const userKey = normalizePreferenceUserKey(session?.user?.email);
  if (!userKey) return Response.json({ error: "Login is required." }, { status: 401, headers });
  try { return Response.json(await getUserActivityPreferenceProfile(userKey), { headers }); }
  catch {
    logPreferenceFailure("self-profile");
    return Response.json({ error: "Activity preferences are temporarily unavailable.", ready: false }, { status: 503, headers });
  }
}
