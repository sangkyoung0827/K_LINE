import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { googleAuthorizationUrl } from "@/lib/googleForms/googleApi";

export async function GET() {
  const access = await getGoogleFormsAccess();
  if (!access.canConnect) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const state = randomUUID();
  const jar = await cookies();
  jar.set("kline_google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/google-forms/oauth", maxAge: 600 });
  return NextResponse.redirect(googleAuthorizationUrl(state));
}
