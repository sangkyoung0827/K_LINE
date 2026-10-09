import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  appDB,
  digest,
  memberBy,
  requireAppEnabled,
  secret,
} from "@/lib/woohyukmonApp/server";
import { AppError } from "@/lib/woohyukmonApp/model";
import { errorResponse } from "@/lib/woohyukmonApp/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireAppEnabled();
    const url = new URL(request.url),
      challenge = url.searchParams.get("challenge"),
      state = url.searchParams.get("state");
    if (
      !challenge ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
      !state ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(state)
    )
      throw new AppError("INVALID_LOGIN_REQUEST");
    const session = await auth();
    if (!session?.user?.email)
      return NextResponse.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(url.pathname + url.search)}`,
          url.origin,
        ),
      );
    const actor = await memberBy(
      "email",
      session.user.email.trim().toLowerCase(),
    );
    const pending = await appDB<unknown[]>(
      `woo_v1_deletion_requests?member_id=eq.${actor.id}&status=in.(pending,processing)&limit=1`,
    );
    if (pending.length) throw new AppError("DELETION_PENDING", 403);
    const code = secret();
    await appDB("woo_v1_mobile_grants", {
      method: "POST",
      body: JSON.stringify({
        code_hash: digest(code),
        member_id: actor.id,
        challenge,
        expires_at: new Date(Date.now() + 120000).toISOString(),
      }),
    });
    // Fixed native callback. Never accept an arbitrary redirect URL or put tokens in links.
    return NextResponse.redirect(
      `woohyukmon://auth?code=${code}&state=${state}`,
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (error) {
    return errorResponse(request, error);
  }
}
