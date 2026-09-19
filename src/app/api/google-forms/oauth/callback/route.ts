import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleFormsAccess } from "@/lib/googleForms/access";
import { connectGoogleOperationsAccount } from "@/lib/googleForms/googleApi";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get("kline_google_oauth_state")?.value;
  jar.delete("kline_google_oauth_state");
  const access = await getGoogleFormsAccess();
  if (!access.canConnect || !expected || expected !== url.searchParams.get("state")) return NextResponse.redirect(new URL("/admin/google-forms?error=oauth_state", url.origin));
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/admin/google-forms?error=oauth_denied", url.origin));
  try {
    await connectGoogleOperationsAccount(code, access.email);
    return NextResponse.redirect(new URL("/admin/google-forms?connected=1", url.origin));
  } catch (error) {
    console.error("Google Forms OAuth callback failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(new URL("/admin/google-forms?error=oauth_failed", url.origin));
  }
}
