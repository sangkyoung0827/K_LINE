import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getCurrentHanhwalAccess, getHanhwalOfficialTeamChatUrl } from "@/lib/hanhwalAccess";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isOfficialMember) {
    return NextResponse.json(
      { error: "Hanhwal official membership is required." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  const qrBuffer = await QRCode.toBuffer(getHanhwalOfficialTeamChatUrl(), {
    errorCorrectionLevel: "M",
    margin: 2,
    type: "png",
    width: 720
  });

  return new NextResponse(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="hanhwal-official-team-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
