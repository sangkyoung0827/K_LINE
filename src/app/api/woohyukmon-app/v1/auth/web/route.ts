import { NextResponse } from "next/server";
import { auth, signIn, signOut } from "@/auth";
import { requireWebAuthEnabled, webReturnPath } from "@/lib/woohyukmonApp/webAuth";
import { AppError } from "@/lib/woohyukmonApp/model";
import { respond, errorResponse } from "@/lib/woohyukmonApp/http";

export async function GET(req: Request) {
  try { requireWebAuthEnabled(); webReturnPath(); }
  catch (e) { return errorResponse(req, e); }
  const session = await auth();
  if (!session?.user?.email) {
    // Uses the website's provider, scope, account registration and session policy.
    await signIn("google", { redirectTo: "/api/woohyukmon-app/v1/auth/web" });
  }
  return NextResponse.redirect(new URL(webReturnPath(), req.url), {
    status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(req: Request) {
  try {
    requireWebAuthEnabled();
    if (req.headers.get("origin") !== new URL(req.url).origin)
      throw new AppError("INVALID_ORIGIN", 403);
    await signOut({ redirect: false });
    return respond(req, { ok: true });
  } catch (e) { return errorResponse(req, e); }
}
