import QRCode from "qrcode";
import { getCurrentEccAccess } from "@/lib/eccAccess";
import { getEccOperationalSettings } from "@/lib/eccOperations";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCurrentEccAccess();

  if (!access.isOfficialMember) {
    return Response.json(
      { error: "ECC official membership is required." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  const settings = await getEccOperationalSettings();
  const qrBuffer = await QRCode.toBuffer(settings.officialTeamChatUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    type: "png"
  });

  return new Response(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="ecc-official-team-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
