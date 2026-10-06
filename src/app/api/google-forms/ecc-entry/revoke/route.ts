import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revokeExpiredEccFormEntries } from "@/lib/googleForms/eccFormLeases";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const secret = process.env.GOOGLE_FORMS_REVOKER_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!secret || secret.length < 32 || !timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await revokeExpiredEccFormEntries();
    return NextResponse.json(result, { status: result.retry || result.attention ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "REVOCATION_UNAVAILABLE" }, { status: 503 }); }
}
