import QRCode from "qrcode";
import { getCurrentHanhwalAccess } from "@/lib/hanhwalAccess";
import { getHanhwalOperationalSettings } from "@/lib/hanhwalOperations";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getCurrentHanhwalAccess();

  if (!access.isOfficialMember) {
    return Response.json(
      { error: "HANHWAL official membership is required." },
      { status: access.isLoggedIn ? 403 : 401 }
    );
  }

  const settings = await getHanhwalOperationalSettings();
  if (!settings.officialTeamChatUrl) {
    return Response.json({ error: "Hanhwal team chat is not configured." }, { status: 404 });
  }
  const qrBuffer = await QRCode.toBuffer(settings.officialTeamChatUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    type: "png"
  });

  return new Response(new Uint8Array(qrBuffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="hanhwal-official-team-qr.png"',
      "Content-Type": "image/png"
    }
  });
}
