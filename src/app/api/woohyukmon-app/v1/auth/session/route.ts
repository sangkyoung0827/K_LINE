import { auth } from "@/auth";
import { getActor, memberBy } from "@/lib/woohyukmonApp/server";
import { requireWebAuthEnabled } from "@/lib/woohyukmonApp/webAuth";
import { respond, errorResponse } from "@/lib/woohyukmonApp/http";

export async function GET(req: Request) {
  try {
    requireWebAuthEnabled();
    const session = await auth();
    if (!session?.user?.email) return respond(req, { user: null });
    const actor = process.env.WOOHYUKMON_APP_ENABLED === "true"
      ? await getActor(req)
      : await memberBy("email", session.user.email.trim().toLowerCase());
    return respond(req, { user: actor && {
      id: actor.id, name: actor.name, email: actor.email, readOnly: actor.readOnly,
    } });
  } catch (e) { return errorResponse(req, e); }
}
