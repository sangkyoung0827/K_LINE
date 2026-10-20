import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { googleAuthorizationUrl } from "@/lib/googleForms/googleApi";
import { createSignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";
import { getStudioAccess } from "@/lib/eventStudio/access";
import { StudioError } from "@/lib/eventStudio/model";

export async function GET(request: Request) {
  try {
    const personal = new URL(request.url).searchParams.get("mode") === "personal";
    let email: string;
    if (personal) {
      const access = await getStudioAccess();
      if (access.readOnly) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      email = access.email;
    } else {
      const access = await getGoogleFormsAccess();
      if (!access.canConnect) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      email = access.email;
    }
    const state = createSignedWoohyukmonPayload({ namespace: "google_forms_oauth", nonce: randomUUID(), actorEmail: email, personal, expiresAt: Date.now() + 600_000 });
    const jar = await cookies();
    jar.set("kline_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/google-forms/oauth", maxAge: 600 });
    return NextResponse.redirect(googleAuthorizationUrl(state));
  } catch (error) {
    if (error instanceof StudioError && error.status === 401) return NextResponse.redirect(new URL("/login?callbackUrl=%2Fevent-studio", request.url));
    return NextResponse.json({ error: "GOOGLE_AUTH_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
