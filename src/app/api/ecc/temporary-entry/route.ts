import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { eccEntryCookie, eccEntryLifetime, issueEccEntry } from "@/lib/eccTemporaryEntry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.paid !== true) return NextResponse.json({ error: "Payment declaration required" }, { status: 400 });
  const access = await getCurrentEccAccess();
  if (!access.isLoggedIn) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (access.isOfficialMember) return NextResponse.json({ ok: true });
  // A successful negative lookup always overrides a previous outage declaration.
  if (!access.lookupFailed || !access.temporaryEntryEligible) {
    return NextResponse.json({ error: "ECC_MEMBERSHIP_NOT_CONFIRMED" }, { status: 403 });
  }
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Temporary entry unavailable" }, { status: 503 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(eccEntryCookie, issueEccEntry(access.email, secret), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/ecc-official", maxAge: eccEntryLifetime
  });
  return response;
}
