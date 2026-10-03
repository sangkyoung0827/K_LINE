import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { googleAuthorizationUrl } from "@/lib/googleForms/googleApi";
import { createSignedWoohyukmonPayload } from "@/lib/woohyukmon/operations/token";

export async function GET() {
  const access = await getGoogleFormsAccess();
  if (!access.canConnect) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const state = createSignedWoohyukmonPayload({ namespace: "google_forms_oauth", nonce: randomUUID(), actorEmail: access.email, expiresAt: Date.now() + 600_000 });
  const jar = await cookies();
  jar.set("kline_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/google-forms/oauth", maxAge: 600 });
  return NextResponse.redirect(googleAuthorizationUrl(state));
}
