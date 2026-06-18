import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentEccAccess } from "@/lib/eccAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await getCurrentEccAccess();

  if (!access.isOfficialMember) {
    return NextResponse.json(
      { error: "ECC official membership is required." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  const filePath = path.join(process.cwd(), "private", "ecc-official-team-qr.png");
  const qrBuffer = await readFile(filePath);

  return new Response(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'inline; filename="ecc-official-team-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
