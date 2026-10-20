import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { connectGoogleOperationsAccount, withPersonalGoogleConnection } from "@/lib/googleForms/googleApi";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { verifySignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get("kline_google_oauth_state")?.value;
  jar.delete("kline_google_oauth_state");
  let destination = "/admin/google-forms";
  let jobId: string | undefined;
  try {
    if (!expected || expected !== url.searchParams.get("state")) throw new Error("INVALID_STATE");
    const state = verifySignedWoohyukmonPayload(expected) as { namespace: string; actorEmail: string; expiresAt: number; personal?: boolean; jobId?: string };
    if (state.namespace !== "google_forms_oauth" || !Number.isFinite(state.expiresAt) || state.expiresAt <= Date.now()) throw new Error("INVALID_STATE");
    if (state.personal === true) destination = "/event-studio";
    if (state.personal === true && typeof state.jobId === "string") jobId = state.jobId;
    const code = url.searchParams.get("code");
    if (!code) throw new Error("OAUTH_DENIED");
    if (state.personal === true) {
      const access = await getStudioAccess();
      if (access.readOnly || state.actorEmail !== access.email) throw new Error("OAUTH_STATE_ACTOR_MISMATCH");
      await withPersonalGoogleConnection(access.email, () => connectGoogleOperationsAccount(code, access.email));
    } else {
      const access = await getGoogleFormsAccess();
      if (!access.canConnect || state.actorEmail !== access.email) throw new Error("OAUTH_STATE_ACTOR_MISMATCH");
      await connectGoogleOperationsAccount(code, access.email);
    }
    const target = new URL(`${destination}?connected=1`, url.origin);
    if (jobId) target.searchParams.set("job", jobId);
    return NextResponse.redirect(target);
  } catch {
    const target = new URL(`${destination}?error=oauth_failed`, url.origin);
    if (jobId) target.searchParams.set("job", jobId);
    return NextResponse.redirect(target);
  }
}
