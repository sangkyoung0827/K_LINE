import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordSiteVisit } from "@/lib/siteAnalytics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    let userEmail = "";

    try {
      const session = await auth();
      userEmail = session?.user?.email ?? "";
    } catch {
      userEmail = "";
    }

    await recordSiteVisit({
      path: body.path,
      referrer: body.referrer,
      userAgent: request.headers.get("user-agent"),
      userEmail,
      visitorId: body.visitorId
    });
  } catch (error) {
    console.error("K_LINE visit tracking failed", error);
  }

  return NextResponse.json({ ok: true });
}
